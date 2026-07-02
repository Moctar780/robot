import argparse
import asyncio
import math
import sys
import time
from enum import Enum
from typing import Any, Callable, Sequence


class FingerDirection(str, Enum):
    FORWARD = "forward"
    BACKWARD = "backward"
    LEFT = "left"
    RIGHT = "right"
    STOP = "stop"
    GRIPPER_OPEN = "gripper_open"
    GRIPPER_CLOSE = "gripper_close"
    GRIPPER_STOP = "gripper_stop"


class ControlMode(str, Enum):
    BUTTONS = "buttons"
    POINTING = "pointing"


# ── Commandes Sparki (série) ──
_DIRECTION_TO_COMMAND = {
    FingerDirection.FORWARD: "w",
    FingerDirection.BACKWARD: "x",
    FingerDirection.LEFT: "a",
    FingerDirection.RIGHT: "d",
    FingerDirection.STOP: "s",
    FingerDirection.GRIPPER_OPEN: "GO 1",
    FingerDirection.GRIPPER_CLOSE: "GC 1",
    FingerDirection.GRIPPER_STOP: "GS",
}

_GRIPPER_REPEAT_SECONDS = 0.35

_DIRECTION_TO_LABEL = {
    FingerDirection.FORWARD: "avance",
    FingerDirection.BACKWARD: "recule",
    FingerDirection.LEFT: "gauche",
    FingerDirection.RIGHT: "droite",
    FingerDirection.STOP: "stop",
    FingerDirection.GRIPPER_OPEN: "ouvrir pince",
    FingerDirection.GRIPPER_CLOSE: "fermer pince",
    FingerDirection.GRIPPER_STOP: "stop pince",
}

# ── Commandes WebSocket (Babylon.js : speed/steer) ──
DIR_TO_CMD = {
    FingerDirection.FORWARD:  {"speed": 100, "steer": 0},
    FingerDirection.BACKWARD: {"speed": -60, "steer": 0},
    FingerDirection.LEFT:     {"speed": 80,  "steer": 0.5},
    FingerDirection.RIGHT:    {"speed": 80,  "steer": -0.5},
    FingerDirection.STOP:     {"speed": 0,   "steer": 0},
    FingerDirection.GRIPPER_OPEN:  {"speed": 0, "steer": 0, "gripper": "open"},
    FingerDirection.GRIPPER_CLOSE: {"speed": 0, "steer": 0, "gripper": "close"},
    FingerDirection.GRIPPER_STOP:  {"speed": 0, "steer": 0, "gripper": "stop"},
}


def direction_to_sparki_cmd(direction: FingerDirection) -> str:
    return _DIRECTION_TO_COMMAND[direction]


def _is_gripper_motion(direction: FingerDirection) -> bool:
    return direction in {FingerDirection.GRIPPER_OPEN, FingerDirection.GRIPPER_CLOSE}


def _distance(a: Any, b: Any) -> float:
    return math.hypot(a.x - b.x, a.y - b.y)


def _angle_delta(a: float, b: float) -> float:
    return abs((a - b + 180.0) % 360.0 - 180.0)


def is_index_pointing(landmarks: Sequence[Any]) -> bool:
    wrist = landmarks[0]
    index_mcp = landmarks[5]
    index_pip = landmarks[6]
    index_tip = landmarks[8]

    index_length = _distance(wrist, index_tip)
    index_extended = (
        index_length > 0.12
        and _distance(wrist, index_tip) > _distance(wrist, index_pip) * 1.08
        and _distance(index_pip, index_tip) > _distance(index_mcp, index_pip) * 0.75
    )
    if not index_extended:
        return False

    other_extended = 0
    for pip_idx, tip_idx in ((10, 12), (14, 16), (18, 20)):
        if _distance(wrist, landmarks[tip_idx]) > _distance(wrist, landmarks[pip_idx]) * 1.05:
            other_extended += 1

    return other_extended <= 1


def classify_pointing_direction(
    landmarks: Sequence[Any],
    *,
    dead_angle_deg: float,
) -> FingerDirection:
    if not is_index_pointing(landmarks):
        return FingerDirection.STOP

    wrist = landmarks[0]
    index_tip = landmarks[8]
    dx = index_tip.x - wrist.x
    dy = index_tip.y - wrist.y

    if math.hypot(dx, dy) < 0.12:
        return FingerDirection.STOP

    angle = math.degrees(math.atan2(-dy, dx))
    candidates = (
        (FingerDirection.RIGHT, 0.0),
        (FingerDirection.FORWARD, 90.0),
        (FingerDirection.LEFT, 180.0),
        (FingerDirection.BACKWARD, -90.0),
    )
    direction, delta = min(
        ((direction, _angle_delta(angle, target)) for direction, target in candidates),
        key=lambda item: item[1],
    )
    return direction if delta <= dead_angle_deg else FingerDirection.STOP


def _button_rects(width: int, height: int) -> dict[FingerDirection, tuple[int, int, int, int]]:
    size = max(72, min(width, height) // 7)
    gap = max(8, size // 8)
    center_x = width - (size * 2 + gap)
    center_y = height // 2
    gripper_width = size * 2
    gripper_x = gap
    gripper_y = center_y - size * 3 // 2 - gap

    return {
        FingerDirection.FORWARD: (
            center_x - size // 2,
            center_y - size * 3 // 2 - gap,
            center_x + size // 2,
            center_y - size // 2 - gap,
        ),
        FingerDirection.BACKWARD: (
            center_x - size // 2,
            center_y + size // 2 + gap,
            center_x + size // 2,
            center_y + size * 3 // 2 + gap,
        ),
        FingerDirection.LEFT: (
            center_x - size * 3 // 2 - gap,
            center_y - size // 2,
            center_x - size // 2 - gap,
            center_y + size // 2,
        ),
        FingerDirection.RIGHT: (
            center_x + size // 2 + gap,
            center_y - size // 2,
            center_x + size * 3 // 2 + gap,
            center_y + size // 2,
        ),
        FingerDirection.STOP: (
            center_x - size // 2,
            center_y - size // 2,
            center_x + size // 2,
            center_y + size // 2,
        ),
        FingerDirection.GRIPPER_OPEN: (
            gripper_x,
            gripper_y,
            gripper_x + gripper_width,
            gripper_y + size,
        ),
        FingerDirection.GRIPPER_CLOSE: (
            gripper_x,
            gripper_y + size + gap,
            gripper_x + gripper_width,
            gripper_y + size * 2 + gap,
        ),
        FingerDirection.GRIPPER_STOP: (
            gripper_x,
            gripper_y + (size + gap) * 2,
            gripper_x + gripper_width,
            gripper_y + size * 3 + gap * 2,
        ),
    }


def _contains(rect: tuple[int, int, int, int], point: tuple[int, int]) -> bool:
    x1, y1, x2, y2 = rect
    x, y = point
    return x1 <= x <= x2 and y1 <= y <= y2


def classify_button_direction(
    landmarks: Sequence[Any] | None,
    *,
    frame_shape: tuple[int, ...],
) -> FingerDirection:
    if not landmarks:
        return FingerDirection.STOP

    height, width = frame_shape[:2]
    index_tip = landmarks[8]
    point = (int(index_tip.x * width), int(index_tip.y * height))

    for direction, rect in _button_rects(width, height).items():
        if _contains(rect, point):
            return direction
    return FingerDirection.STOP


def _draw_virtual_buttons(frame: Any, active_direction: FingerDirection) -> None:
    import cv2

    height, width = frame.shape[:2]
    labels = {
        FingerDirection.FORWARD: "AVANCE",
        FingerDirection.BACKWARD: "RECULE",
        FingerDirection.LEFT: "GAUCHE",
        FingerDirection.RIGHT: "DROITE",
        FingerDirection.STOP: "STOP",
        FingerDirection.GRIPPER_OPEN: "OUVRIR",
        FingerDirection.GRIPPER_CLOSE: "FERMER",
        FingerDirection.GRIPPER_STOP: "STOP PINCE",
    }

    for direction, rect in _button_rects(width, height).items():
        x1, y1, x2, y2 = rect
        active = direction == active_direction
        fill_color = (0, 180, 0) if active else (55, 55, 55)
        border_color = (0, 255, 0) if active else (180, 180, 180)

        overlay = frame.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), fill_color, -1)
        cv2.addWeighted(overlay, 0.35, frame, 0.65, 0, frame)
        cv2.rectangle(frame, (x1, y1), (x2, y2), border_color, 2)

        text = labels[direction]
        text_size, _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        text_x = x1 + ((x2 - x1) - text_size[0]) // 2
        text_y = y1 + ((y2 - y1) + text_size[1]) // 2
        cv2.putText(
            frame,
            text,
            (text_x, text_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (255, 255, 255),
            1,
        )


def _draw_overlay(
    frame: Any,
    landmarks: Sequence[Any] | None,
    direction: FingerDirection,
    command: str,
    control_mode: ControlMode,
) -> None:
    import cv2

    height, width = frame.shape[:2]
    label = f"{_DIRECTION_TO_LABEL[direction]} ({command})"
    cv2.putText(frame, label, (16, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
    if control_mode == ControlMode.BUTTONS:
        _draw_virtual_buttons(frame, direction)
        help_text = "Placez l'index sur un bouton | q ou Esc: quitter"
    else:
        help_text = "Index pointe: haut/bas/gauche/droite | q ou Esc: quitter"
    cv2.putText(
        frame,
        help_text,
        (16, height - 16),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (255, 255, 255),
        1,
    )

    if not landmarks:
        return

    wrist = landmarks[0]
    index_tip = landmarks[8]
    start = (int(wrist.x * width), int(wrist.y * height))
    end = (int(index_tip.x * width), int(index_tip.y * height))
    cv2.arrowedLine(frame, start, end, (0, 255, 255), 3, tipLength=0.25)


def _log_command(command: str, cmd_dict: dict | None = None) -> None:
    if cmd_dict:
        extra = f"speed={cmd_dict['speed']} steer={cmd_dict['steer']}"
        if "gripper" in cmd_dict:
            extra = f"gripper={cmd_dict['gripper']}"
        print(f"  {command}  {extra}")
    else:
        print(f"Commande : {command}")


def run_camera_control(
    *,
    camera_index: int = 0,
    mirror: bool = True,
    control_mode: str = "pointing",
    dead_angle: float = 25.0,
    min_confidence: float = 0.6,
    on_command: Callable[[dict], None] | None = None,
) -> int:
    try:
        import cv2
        import mediapipe as mp
    except ImportError as exc:
        print(
            "Dépendance caméra manquante. Installez les dépendances avec : "
            "pip install -r requirements.txt",
            file=sys.stderr,
        )
        print(f"Détail : {exc}", file=sys.stderr)
        return 1

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        print(f"Impossible d'ouvrir la caméra {camera_index}.", file=sys.stderr)
        return 1

    mp_hands = mp.solutions.hands
    mp_drawing = mp.solutions.drawing_utils
    last_command: str | None = None
    last_direction = FingerDirection.STOP
    last_gripper_at = 0.0
    mode = ControlMode(control_mode)

    print(f"Mode caméra ({mode.value}) — q ou Esc pour quitter.")

    try:
        with mp_hands.Hands(
            max_num_hands=1,
            model_complexity=0,
            min_detection_confidence=min_confidence,
            min_tracking_confidence=min_confidence,
        ) as hands:
            while True:
                ok, frame = cap.read()
                if not ok:
                    print("Lecture caméra impossible.", file=sys.stderr)
                    return 1

                if mirror:
                    frame = cv2.flip(frame, 1)

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                rgb.flags.writeable = False
                results = hands.process(rgb)
                rgb.flags.writeable = True

                landmarks = None
                direction = FingerDirection.STOP
                if results.multi_hand_landmarks:
                    hand_landmarks = results.multi_hand_landmarks[0]
                    landmarks = hand_landmarks.landmark
                    if mode == ControlMode.BUTTONS:
                        direction = classify_button_direction(
                            landmarks,
                            frame_shape=frame.shape,
                        )
                    else:
                        direction = classify_pointing_direction(
                            landmarks,
                            dead_angle_deg=dead_angle,
                        )
                    mp_drawing.draw_landmarks(
                        frame,
                        hand_landmarks,
                        mp_hands.HAND_CONNECTIONS,
                    )

                command = direction_to_sparki_cmd(direction)
                cmd_dict = DIR_TO_CMD.get(direction, DIR_TO_CMD[FingerDirection.STOP])
                cmd_dict["direction"] = direction.value

                if command != last_command:
                    last_command = command
                    last_direction = direction
                    _log_command(command, cmd_dict)
                    if on_command:
                        on_command(cmd_dict)

                _draw_overlay(frame, landmarks, direction, command, mode)
                # Redimensionner pour une meilleure visibilité
                scale = 960 / frame.shape[1]
                new_w, new_h = 960, int(frame.shape[0] * scale)
                display = cv2.resize(frame, (new_w, new_h))
                cv2.imshow("Camera Bridge — Babylon.js", display)
                key = cv2.waitKey(1) & 0xFF
                if key in (ord("q"), 27):
                    break
    finally:
        cap.release()
        cv2.destroyAllWindows()

    return 0


# ── Serveur WebSocket pour Babylon.js ──

class CameraBridge:
    """Pont WebSocket entre la caméra et la simulation Babylon.js."""

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.clients: set[asyncio.Queue] = set()

    async def register(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self.clients.add(q)
        return q

    async def unregister(self, q: asyncio.Queue) -> None:
        self.clients.discard(q)

    async def broadcast(self, cmd: dict) -> None:
        if self.dry_run:
            return
        dead: set[asyncio.Queue] = set()
        for q in self.clients:
            try:
                q.put_nowait(cmd)
            except asyncio.QueueFull:
                dead.add(q)
        for q in dead:
            await self.unregister(q)

    def make_on_command(self) -> Callable[[dict], None]:
        """Retourne un callback synchrone qui broadcaste la commande."""
        def _on_command(cmd: dict) -> None:
            label = {"forward": "⬆ AVANCE", "backward": "⬇ RECULE",
                     "left": "⬅ GAUCHE", "right": "➡ DROITE",
                     "stop": "⏹ STOP"}.get(cmd.get("direction", ""), "⏹ ?")
            print(f"  {label}")
            if not self.dry_run:
                asyncio.create_task(self.broadcast(cmd))
        return _on_command


async def ws_handler(websocket):
    bridge: CameraBridge = websocket.bridge
    q = await bridge.register()
    try:
        async with websocket:
            async for _ in websocket:
                pass
    finally:
        await bridge.unregister(q)


async def main():
    parser = argparse.ArgumentParser(
        description="Pont caméra → simulation Babylon.js (WebSocket)"
    )
    parser.add_argument("--port", type=int, default=8765,
                        help="Port du serveur WebSocket")
    parser.add_argument("--camera", type=int, default=0,
                        help="Index de la webcam")
    parser.add_argument("--mirror", action="store_true", default=True,
                        help="Afficher l'image en miroir (défaut: True)")
    parser.add_argument("--no-mirror", action="store_true",
                        help="Désactiver le miroir")
    parser.add_argument("--dead-angle", type=float, default=25.0,
                        help="Tolérance angulaire du mode pointing (degrés)")
    parser.add_argument("--mode", choices=["pointing", "buttons"],
                        default="pointing",
                        help="Mode de contrôle : pointage (défaut) ou boutons virtuels")
    parser.add_argument("--min-confidence", type=float, default=0.6,
                        help="Confiance minimale MediaPipe (défaut: 0.6)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Afficher les commandes sans envoyer via WebSocket")
    args = parser.parse_args()

    mirror = args.mirror and not args.no_mirror
    bridge = CameraBridge(dry_run=args.dry_run)

    from websockets.asyncio.server import serve

    print(f"🌐 Serveur WebSocket sur ws://localhost:{args.port}")
    print(f"📷 Caméra ouverte — mode {args.mode} — Ctrl+C pour quitter")

    async with serve(ws_handler, "0.0.0.0", args.port) as server:
        server.bridge = bridge
        run_camera_control(
            camera_index=args.camera,
            mirror=mirror,
            control_mode=args.mode,
            dead_angle=args.dead_angle,
            min_confidence=args.min_confidence,
            on_command=bridge.make_on_command(),
        )

    return 0


if __name__ == "__main__":
    asyncio.run(main())