#!/usr/bin/env python3
"""
Pont WebSocket entre la détection caméra (MediaPipe) et la simulation Babylon.js.

Usage :
    source /home/moctar/python_env/ai_env/bin/activate
    python camera_bridge.py [--port 8765] [--no-mirror] [--dead-angle 25]
"""

import argparse
import asyncio
import math
import os
import sys
import time
from enum import Enum

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


class FingerDirection(Enum):
    FORWARD = "forward"
    BACKWARD = "backward"
    LEFT = "left"
    RIGHT = "right"
    STOP = "stop"


DIR_TO_CMD = {
    FingerDirection.FORWARD:  {"speed": 100, "steer": 0},
    FingerDirection.BACKWARD: {"speed": -60, "steer": 0},
    FingerDirection.LEFT:     {"speed": 80,  "steer": 0.5},
    FingerDirection.RIGHT:    {"speed": 80,  "steer": -0.5},
    FingerDirection.STOP:     {"speed": 0,   "steer": 0},
}


# ── Géométrie de la main (portée depuis sparki_djelia) ──
def _dist(a, b):
    return math.hypot(a.x - b.x, a.y - b.y)


def _angle_delta(a, b):
    return abs((a - b + 180.0) % 360.0 - 180.0)


def is_index_pointing(landmarks):
    w = landmarks[0]
    mcp, pip, tip = landmarks[5], landmarks[6], landmarks[8]
    l = _dist(w, tip)
    if l <= 0.12 or _dist(w, tip) <= _dist(w, pip) * 1.08:
        return False
    if _dist(pip, tip) <= _dist(mcp, pip) * 0.75:
        return False
    other = 0
    for pi, ti in ((10, 12), (14, 16), (18, 20)):
        if _dist(w, landmarks[ti]) > _dist(w, landmarks[pi]) * 1.05:
            other += 1
    return other <= 1


def classify_pointing_direction(landmarks, dead_angle_deg=25):
    if not is_index_pointing(landmarks):
        return FingerDirection.STOP
    w, t = landmarks[0], landmarks[8]
    dx, dy = t.x - w.x, t.y - w.y
    if math.hypot(dx, dy) < 0.12:
        return FingerDirection.STOP
    angle = math.degrees(math.atan2(-dy, dx))
    candidates = [
        (FingerDirection.RIGHT, 0.0),
        (FingerDirection.FORWARD, 90.0),
        (FingerDirection.LEFT, 180.0),
        (FingerDirection.BACKWARD, -90.0),
    ]
    best = min(candidates, key=lambda c: _angle_delta(angle, c[1]))
    return best[0] if _angle_delta(angle, best[1]) <= dead_angle_deg else FingerDirection.STOP


class CameraBridge:
    def __init__(self, mirror=True, dead_angle=25):
        self.mirror = mirror
        self.dead_angle = dead_angle
        self.last_direction = None
        self.last_send_at = 0
        self.clients = set()
        self._results = None

    async def register(self):
        q = asyncio.Queue()
        self.clients.add(q)
        return q

    async def unregister(self, q):
        self.clients.discard(q)

    async def broadcast(self, cmd):
        dead = set()
        for q in self.clients:
            try:
                q.put_nowait(cmd)
            except asyncio.QueueFull:
                dead.add(q)
        for q in dead:
            await self.unregister(q)

    def _on_result(self, result, img, ts):
        self._results = result

    async def run_camera(self, camera_index=0):
        cap = cv2.VideoCapture(camera_index)
        if not cap.isOpened():
            print("❌ Impossible d'ouvrir la caméra")
            return

        # Modèle HandLandmarker (MediaPipe nouvelle API)
        model_path = "hand_landmarker.task"
        if not os.path.exists(model_path):
            print("📥 Téléchargement du modèle HandLandmarker...")
            import urllib.request
            url = ("https://storage.googleapis.com/mediapipe-models/"
                   "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task")
            urllib.request.urlretrieve(url, model_path)

        options = vision.HandLandmarkerOptions(
            base_options=python.BaseOptions(model_asset_path=model_path),
            running_mode=vision.RunningMode.LIVE_STREAM,
            num_hands=1,
            min_hand_detection_confidence=0.6,
            min_tracking_confidence=0.5,
            result_callback=self._on_result,
        )
        detector = vision.HandLandmarker.create_from_options(options)

        print(f"📷 Caméra ouverte — Ctrl+C pour quitter")
        print("➡  Dirige l'index : haut=AVANCE bas=RECULE gauche/droite=TOURNE")

        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    await asyncio.sleep(0.1)
                    continue
                if self.mirror:
                    frame = cv2.flip(frame, 1)

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                detector.detect_async(mp_img, time.monotonic_ns())

                direction = FingerDirection.STOP
                if self._results and self._results.hand_landmarks:
                    lm = self._results.hand_landmarks[0]
                    direction = classify_pointing_direction(lm, dead_angle_deg=self.dead_angle)

                cmd = DIR_TO_CMD.get(direction, DIR_TO_CMD[FingerDirection.STOP])
                cmd["direction"] = direction.value
                now = time.monotonic()

                if direction != self.last_direction or now - self.last_send_at > 2.0:
                    self.last_direction = direction
                    self.last_send_at = now
                    await self.broadcast(cmd)
                    label = {"forward":"⬆ AVANCE","backward":"⬇ RECULE",
                             "left":"⬅ GAUCHE","right":"➡ DROITE","stop":"⏹ STOP"}.get(direction.value,"⏹ STOP")
                    print(f"  {label}  speed={cmd['speed']} steer={cmd['steer']}")

                self._draw_overlay(frame, direction)
                cv2.imshow("Camera Bridge — Babylon.js", frame)
                key = cv2.waitKey(1) & 0xFF
                if key in (ord('q'), 27):
                    break
        finally:
            cap.release()
            cv2.destroyAllWindows()
            detector.close()
            await self.broadcast(DIR_TO_CMD[FingerDirection.STOP] | {"direction": "stop"})

    def _draw_overlay(self, frame, direction):
        h, w = frame.shape[:2]
        label = {"forward":"AVANCE","backward":"RECULE",
                 "left":"GAUCHE","right":"DROITE","stop":"STOP"}.get(direction.value,"STOP")
        cv2.putText(frame, f"> {label}", (16, 32),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
        if self._results and self._results.hand_landmarks:
            lm = self._results.hand_landmarks[0]
            sx = int(lm[0].x * w); sy = int(lm[0].y * h)
            ex = int(lm[8].x * w); ey = int(lm[8].y * h)
            cv2.arrowedLine(frame, (sx, sy), (ex, ey), (0, 255, 255), 3, tipLength=0.25)
        cv2.putText(frame, "q/Esc: quitter", (16, h-16),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)

    def _process_hand(self, landmarks):
        """Convertit les NormalizedLandmark en objets avec .x, .y, .z"""
        return landmarks


async def ws_handler(websocket):
    bridge = websocket.bridge
    q = await bridge.register()
    try:
        async with websocket:
            async for _ in websocket:
                pass
    finally:
        await bridge.unregister(q)
    await bridge.broadcast(DIR_TO_CMD[FingerDirection.STOP] | {"direction": "stop"})


async def main():
    parser = argparse.ArgumentParser(description="Pont caméra → Babylon.js")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--no-mirror", action="store_true")
    parser.add_argument("--dead-angle", type=float, default=25)
    args = parser.parse_args()

    bridge = CameraBridge(mirror=not args.no_mirror, dead_angle=args.dead_angle)

    from websockets.asyncio.server import serve

    print(f"🌐 Serveur WebSocket sur ws://localhost:{args.port}")
    async with serve(ws_handler, "0.0.0.0", args.port) as server:
        server.bridge = bridge
        await bridge.run_camera(args.camera)


if __name__ == "__main__":
    asyncio.run(main())

