// ── Contrôle du robot simulé par caméra (WebSocket Python + MediaPipe) ──
// Adapté de sparki_djelia/sparki_djelia/camera_control.py
// Deux modes :
//   1. WebSocket → se connecte au bridge Python (camera_bridge.py)
//   2. MediaPipe → détection directe dans le navigateur

let active = false;
let stream = null;
let animFrameId = null;
let lastDirection = 'stop';
let ws = null;

const WS_URL = 'ws://localhost:8765';

const DEAD_ANGLE_DEG = 25;
const MIN_INDEX_LENGTH = 0.12;

const DIR_TO_CMD = {
    forward:  () => { window.setRobotSpeed(100); window.setRobotSteering(0); },
    backward: () => { window.setRobotSpeed(-60); window.setRobotSteering(0); },
    left:     () => { window.setRobotSpeed(80);  window.setRobotSteering(0.5); },
    right:    () => { window.setRobotSpeed(80);  window.setRobotSteering(-0.5); },
    stop:     () => { window.setRobotSpeed(0);   window.setRobotSteering(0); },
};

export function isCameraActive() { return active; }

export async function startCameraControl() {
    if (active) return;
    active = true;

    // 1. Démarrer le processus Python via le serveur local
    const started = await startPythonProcess();

    // 2. Attendre le WebSocket (avec retry)
    const wsOk = await waitForWebSocket(15); // 15 tentatives × 500ms = 7.5s max
    if (wsOk) {
        console.log('📷 Détection caméra Python active');
        afficherIndicateurWS(true);
        return;
    }

    // 3. Fallback navigateur (si l'utilisateur accorde la permission)
    console.log('📷 Utilisation du navigateur (fallback)');
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.createElement('video');
        video.id = 'cameraVideo';
        video.srcObject = stream;
        video.playsInline = true;
        video.play();

        await new Promise(r => { video.onloadedmetadata = r; });

        const canvas = document.createElement('canvas');
        canvas.id = 'cameraOverlay';
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        canvas.style.cssText = `
            position: fixed; bottom: 12px; right: 12px;
            width: 240px; height: 180px; z-index: 9998;
            border: 2px solid #4caf50; border-radius: 8px;
            object-fit: cover; box-shadow: 0 4px 20px rgba(0,0,0,0.8);
        `;
        document.body.appendChild(canvas);

        if (typeof Hands !== 'undefined') {
            await startMediaPipe(video, canvas);
        } else {
            startFallback(video, canvas);
        }
    } catch (err) {
        console.error('Erreur caméra :', err);
        stopCameraControl();
    }
}

export function stopCameraControl() {
    active = false;
    // Déconnexion WebSocket
    if (ws) {
        ws.close();
        ws = null;
    }
    // Arrêter le processus Python
    stopPythonProcess();
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    document.getElementById('cameraOverlay')?.remove();
    document.getElementById('cameraVideo')?.remove();
    document.getElementById('wsIndicator')?.remove();
    window.setRobotSpeed(0);
    window.setRobotSteering(0);
    lastDirection = 'stop';
}

// ── Connexion WebSocket au bridge Python ──
async function tryWebSocket() {
    return new Promise((resolve) => {
        try {
            ws = new WebSocket(WS_URL);
            ws.onopen = () => resolve(true);
            ws.onerror = () => { ws = null; resolve(false); };
            ws.onclose = () => { if (active) stopCameraControl(); };
            ws.onmessage = (event) => {
                try {
                    const cmd = JSON.parse(event.data);
                    if (cmd.direction && cmd.direction !== lastDirection) {
                        lastDirection = cmd.direction;
                        const fn = DIR_TO_CMD[cmd.direction] || DIR_TO_CMD.stop;
                        fn();
                    }
                } catch (e) { /* ignorer */ }
            };
            setTimeout(() => {
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    ws?.close(); ws = null; resolve(false);
                }
            }, 1500);
        } catch (e) { resolve(false); }
    });
}

async function waitForWebSocket(maxRetries = 15) {
    for (let i = 0; i < maxRetries; i++) {
        const ok = await tryWebSocket();
        if (ok) return true;
        await new Promise(r => setTimeout(r, 500));
    }
    return false;
}

// ── Démarrer le processus Python via le serveur local ──
async function startPythonProcess() {
    try {
        const r = await fetch('http://localhost:3001/start', { method: 'POST' });
        const data = await r.json();
        return data.status === 'started' || data.status === 'already_running';
    } catch (e) {
        console.log('⚠️ Serveur caméra (3001) indisponible. Fallback navigateur.');
        return false;
    }
}

async function stopPythonProcess() {
    try {
        await fetch('http://localhost:3001/stop', { method: 'POST' });
    } catch (e) { /* ignorer */ }
}

function afficherIndicateurWS(ok) {
    const el = document.createElement('div');
    el.id = 'wsIndicator';
    el.textContent = ok ? '🖥️ Bridge Python connecté' : '⚠️ Bridge non connecté';
    el.style.cssText = `
        position: fixed; bottom: 12px; left: 12px; z-index: 9999;
        background: ${ok ? 'rgba(76,175,80,0.9)' : 'rgba(255,152,0,0.9)'};
        color: #fff; padding: 6px 14px; border-radius: 6px;
        font-size: 13px; font-weight: bold;
        box-shadow: 0 2px 10px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(el);
}

// ── Mode MediaPipe (détection de la main) ──
async function startMediaPipe(video, canvas) {
    // Attendre que les scripts CDN soient chargés
    const hands = new Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
    });
    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
    });
    hands.onResults(results => {
        if (!active) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (results.multiHandLandmarks?.length > 0) {
            const lm = results.multiHandLandmarks[0];
            const dir = classifyPointingDirection(lm);
            applyDirection(dir);
            drawLandmarks(ctx, lm, canvas.width, canvas.height);
            drawLabel(ctx, dir);
        } else {
            applyDirection('stop');
        }
        ctx.restore();
    });

    const camera = new Camera(video, {
        onFrame: async () => { if (active) await hands.send({ image: video }); },
        width: 320, height: 240,
    });
    await camera.start();
}

// ── Fallback : capture d'écran simple sans MediaPipe ──
function startFallback(video, canvas) {
    const ctx = canvas.getContext('2d');

    function frame() {
        if (!active) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '14px sans-serif';
        ctx.fillText('📷 Caméra active', 10, 20);
        ctx.fillText('(chargez MediaPipe pour le contrôle gestuel)', 10, 40);
        animFrameId = requestAnimationFrame(frame);
    }
    frame();
}

// ── Géométrie de la main (portée depuis Python) ──
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angleDelta(a, b) { return Math.abs(((a - b + 180) % 360) - 180); }

function isIndexPointing(lm) {
    const [wrist, mcp, pip, tip] = [lm[0], lm[5], lm[6], lm[8]];
    const len = dist(wrist, tip);
    if (len <= MIN_INDEX_LENGTH) return false;
    if (dist(wrist, tip) <= dist(wrist, pip) * 1.08) return false;
    if (dist(pip, tip) <= dist(mcp, pip) * 0.75) return false;
    let other = 0;
    for (const [pi, ti] of [[10,12],[14,16],[18,20]]) {
        if (dist(wrist, lm[ti]) > dist(wrist, lm[pi]) * 1.05) other++;
    }
    return other <= 1;
}

function classifyPointingDirection(lm) {
    if (!isIndexPointing(lm)) return 'stop';
    const [w, t] = [lm[0], lm[8]];
    const dx = t.x - w.x, dy = t.y - w.y;
    if (Math.hypot(dx, dy) < MIN_INDEX_LENGTH) return 'stop';
    const angle = Math.atan2(-dy, dx) * 180 / Math.PI;
    const candidates = [
        ['right', 0], ['forward', 90], ['left', 180], ['backward', -90],
    ];
    let best = candidates[0], bestD = angleDelta(angle, best[1]);
    for (let i = 1; i < candidates.length; i++) {
        const d = angleDelta(angle, candidates[i][1]);
        if (d < bestD) { bestD = d; best = candidates[i]; }
    }
    return bestD <= DEAD_ANGLE_DEG ? best[0] : 'stop';
}

function applyDirection(dir) {
    if (dir === lastDirection) return;
    lastDirection = dir;
    (DIR_TO_CMD[dir] || DIR_TO_CMD.stop)();
}

// ── Dessin ──
function drawLandmarks(ctx, lm, w, h) {
    const conn = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
                  [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
                  [13,17],[17,18],[18,19],[19,20],[0,17]];
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2;
    for (const [i, j] of conn) {
        ctx.beginPath();
        ctx.moveTo(lm[i].x * w, lm[i].y * h);
        ctx.lineTo(lm[j].x * w, lm[j].y * h);
        ctx.stroke();
    }
    for (const p of lm) {
        ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4444'; ctx.fill();
    }
}

function drawLabel(ctx, dir) {
    const labels = { forward: '⬆', backward: '⬇', left: '⬅', right: '➡', stop: '⏹' };
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#00ff00';
    ctx.fillText(labels[dir] || '⏹', 10, 50);
}
