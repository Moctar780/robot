/**
 * Serveur HTTP local qui lance/arrête le processus Python de détection caméra.
 * Démarre avec Vite via "npm run dev:full"
 */
import { spawn } from 'child_process';
import { createServer } from 'http';
import { URL } from 'url';

const PORT = 3001;
let pythonProcess = null;

function startPython(res) {
  if (pythonProcess) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'already_running' }));
    return;
  }

  const cmd = 'bash';
  const args = ['-c', 'source /home/moctar/python_env/ai_env/bin/activate && python camera_bridge.py'];

  pythonProcess = spawn(cmd, args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[camera] ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[camera] ${data.toString().trim()}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`[camera] Processus terminé (code ${code})`);
    pythonProcess = null;
  });

  console.log('[camera] Démarrage du processus Python...');
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'started' }));

  // Attendre un peu que le serveur WebSocket Python soit prêt
  setTimeout(() => {
    console.log('[camera] Prêt (WebSocket sur ws://localhost:8765)');
  }, 3000);
}

function stopPython(res) {
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
    console.log('[camera] Processus arrêté');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'stopped' }));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'not_running' }));
  }
}

function statusPython(res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ running: pythonProcess !== null }));
}

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  switch (path) {
    case '/start':
      startPython(res);
      break;
    case '/stop':
      stopPython(res);
      break;
    case '/status':
      statusPython(res);
      break;
    default:
      res.writeHead(404);
      res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`🎥 Serveur caméra sur http://localhost:${PORT}`);
  console.log(`   POST /start  → lancer la détection`);
  console.log(`   POST /stop   → arrêter la détection`);
  console.log(`   GET  /status → état du processus`);
});
