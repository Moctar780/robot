#!/usr/bin/env python3
"""
Pont WebSocket entre la détection caméra (MediaPipe) et la simulation Babylon.js.

Usage :
    source /home/moctar/python_env/ai_env/bin/activate
    python camera_bridge.py [--port 8765] [--no-mirror] [--dead-angle 25]
"""

import argparse
import asyncio
import importlib.util
import math
import sys
import time
import os

# Ajouter sparki_djelia au path
SPARKI_PATH = os.path.expanduser("~/Desktop/projets/arduino/sparki_djelia/sparki_djelia")
if SPARKI_PATH not in sys.path:
    sys.path.insert(0, os.path.dirname(SPARKI_PATH))

try:
    from sparki_djelia.camera_control import (
        classify_pointing_direction,
        ControlMode,
        FingerDirection,
    )
    HAS_CAMERA = True
except ImportError:
    print("⚠️  sparki_djelia non trouvé. Utilisation du module local.")
    HAS_CAMERA = False
    # Définitions minimales de secours
    from enum import Enum
    class FingerDirection(str, Enum):
        FORWARD = "forward"; BACKWARD = "backward"; LEFT = "left"
        RIGHT = "right"; STOP = "stop"

import cv2
import mediapipe as mp


# ── Mappage direction → commandes robot simulé ──
DIR_TO_CMD = {
    FingerDirection.FORWARD:  {"speed": 100, "steer": 0},
    FingerDirection.BACKWARD: {"speed": -60, "steer": 0},
    FingerDirection.LEFT:     {"speed": 80,  "steer": 0.5},
    FingerDirection.RIGHT:    {"speed": 80,  "steer": -0.5},
    FingerDirection.STOP:     {"speed": 0,   "steer": 0},
}


class CameraBridge:
    def __init__(self, mirror: bool = True, dead_angle: float = 25):
        self.mirror = mirror
        self.dead_angle = dead_angle
        self.last_direction = None
        self.last_send_at = 0
        self.clients: set[asyncio.Queue] = set()

    # ── WebSocket : les clients s'enregistrent ──
    async def register(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self.clients.add(q)
        return q

    async def unregister(self, q: asyncio.Queue):
        self.clients.discard(q)

    async def broadcast(self, cmd: dict):
        dead = set()
        for q in self.clients:
            try:
                q.put_nowait(cmd)
            except asyncio.QueueFull:
                dead.add(q)
        for q in dead:
            await self.unregister(q)

    # ── Boucle caméra ──
    async def run_camera(self, camera_index: int = 0):
        cap = cv2.VideoCapture(camera_index)
        if not cap.isOpened():
            print("❌ Impossible d'ouvrir la caméra")
            return

        mp_hands = mp.solutions.hands
        hands = mp_hands.Hands(
            max_num_hands=1,
            model_complexity=0,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.5,
        )

        print(f"📷 Caméra ouverte (index {camera_index}) — Ctrl+C pour quitter")
        print("➡  Dirige l'index vers : haut=AVANCE, bas=RECULE, gauche/droite=TOURNE")

        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    await asyncio.sleep(0.1)
                    continue

                if self.mirror:
                    frame = cv2.flip(frame, 1)

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = hands.process(rgb)

                direction = FingerDirection.STOP
                if results.multi_hand_landmarks:
                    landmarks = results.multi_hand_landmarks[0].landmark
                    direction = classify_pointing_direction(
                        landmarks, dead_angle_deg=self.dead_angle
                    )

                cmd = DIR_TO_CMD.get(direction, DIR_TO_CMD[FingerDirection.STOP])
                cmd["direction"] = direction.value

                # N'envoyer que si la direction change
                now = time.monotonic()
                if direction != self.last_direction or now - self.last_send_at > 2.0:
                    self.last_direction = direction
                    self.last_send_at = now
                    await self.broadcast(cmd)
                    label = {
                        "forward": "⬆ AVANCE", "backward": "⬇ RECULE",
                        "left": "⬅ GAUCHE", "right": "➡ DROITE", "stop": "⏹ STOP"
                    }.get(direction.value, "⏹ STOP")
                    print(f"  {label}  speed={cmd['speed']}  steer={cmd['steer']}")

                # Overlay vidéo
                self._draw_overlay(frame, results, direction, cmd)

                cv2.imshow("Camera Bridge — Babylon.js", frame)
                key = cv2.waitKey(1) & 0xFF
                if key in (ord('q'), 27):
                    break

        finally:
            cap.release()
            cv2.destroyAllWindows()
            hands.close()
            # STOP final
            await self.broadcast(DIR_TO_CMD[FingerDirection.STOP] | {"direction": "stop"})

    def _draw_overlay(self, frame, results, direction, cmd):
        h, w = frame.shape[:2]
        label = {
            "forward": "AVANCE", "backward": "RECULE",
            "left": "GAUCHE", "right": "DROITE", "stop": "STOP"
        }.get(direction.value, "STOP")
        cv2.putText(frame, f"> {label}", (16, 32),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)

        if results.multi_hand_landmarks:
            lm = results.multi_hand_landmarks[0].landmark
            wrist = lm[0]; tip = lm[8]
            sx, sy = int(wrist.x * w), int(wrist.y * h)
            ex, ey = int(tip.x * w), int(tip.y * h)
            cv2.arrowedLine(frame, (sx, sy), (ex, ey), (0, 255, 255), 3, tipLength=0.25)

        cv2.putText(frame, "q ou Esc: quitter", (16, h - 16),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)


# ── Serveur WebSocket ──
async def ws_handler(websocket):
    bridge = websocket.bridge
    q = await bridge.register()
    try:
        async with websocket:
            async for _ in websocket:
                pass  # Ignorer les messages entrants
    finally:
        await bridge.unregister(q)
    # Nettoyage : envoyer STOP quand le client se déconnecte
    await bridge.broadcast(DIR_TO_CMD[FingerDirection.STOP] | {"direction": "stop"})


async def send_loop(bridge: CameraBridge):
    """Envoie les commandes aux clients connectés."""
    while True:
        for q in list(bridge.clients):
            try:
                cmd = await asyncio.wait_for(q.get(), timeout=0.1)
                for client_q in bridge.clients:
                    if client_q is not q:
                        try:
                            client_q.put_nowait(cmd)
                        except asyncio.QueueFull:
                            pass
            except asyncio.TimeoutError:
                continue
        await asyncio.sleep(0.01)


async def main():
    parser = argparse.ArgumentParser(description="Pont caméra → Babylon.js")
    parser.add_argument("--port", type=int, default=8765, help="Port WebSocket")
    parser.add_argument("--camera", type=int, default=0, help="Index caméra")
    parser.add_argument("--no-mirror", action="store_true", help="Désactiver le miroir")
    parser.add_argument("--dead-angle", type=float, default=25, help="Angle mort en degrés")
    args = parser.parse_args()

    bridge = CameraBridge(mirror=not args.no_mirror, dead_angle=args.dead_angle)

    import asyncio
    from websockets.asyncio.server import serve

    # Lancer le serveur WebSocket
    print(f"🌐 Serveur WebSocket sur ws://localhost:{args.port}")
    print(f"📡 Connecte-toi depuis le navigateur (bouton 📷 Caméra → WS)")
    print("━" * 50)

    async with serve(ws_handler, "0.0.0.0", args.port) as server:
        # Attacher le bridge aux websockets
        for s in server.sockets:
            pass
        server.bridge = bridge

        # Lancer la caméra et le serveur concurrent
        await asyncio.gather(
            bridge.run_camera(args.camera),
        )


if __name__ == "__main__":
    asyncio.run(main())
