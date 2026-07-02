import { JSDOM } from 'jsdom';
import createContext, { WebGLRenderingContext, WebGL2RenderingContext } from 'gl';
import fs from 'fs';
import path from 'path';

// Make WebGL constructors globally available (Babylon.js uses instanceof checks)
global.WebGLRenderingContext = WebGLRenderingContext;
global.WebGL2RenderingContext = WebGL2RenderingContext;

// 1. Simuler l'environnement du navigateur (DOM)
const dom = new JSDOM(`<!DOCTYPE html><html><body><canvas id="renderCanvas"></canvas></body></html>`, {
    url: `file://${process.cwd()}/`,
    pretendToBeVisual: true
});

global.window = dom.window;
global.document = dom.window.document;
global.XMLHttpRequest = dom.window.XMLHttpRequest;
// Node.js 21+ has a read-only global navigator getter, so use defineProperty
Object.defineProperty(global, 'navigator', {
    value: dom.window.navigator,
    writable: true,
    configurable: true
});

// 2. Injecter un faux canvas compatible WebGL Headless
const canvas = document.getElementById('renderCanvas');
// gl's ANGLE implementation identifies as WebGL2 but doesn't fully support GLSL ES 3.0.
// Force WebGL1 to avoid shader compilation errors with 'layout' qualifiers.
let glContext = null;
canvas.getContext = (type, options) => {
    if (type === 'webgl') {
        if (!glContext) {
            glContext = createContext(1024, 768, { preserveDrawingBuffer: true });
        }
        return glContext;
    }
    // Return null for webgl2 requests to force Babylon to use WebGL1
    if (type === 'webgl2') return null;
    return null;
};

// 3. Importer explicitement Babylon.js et le rendre global pour votre script
import * as BABYLON from '@babylonjs/core';
global.BABYLON = BABYLON;

// 4. Configurer Havok Physics (Wasm) pour Node.js
import HavokPhysics from '@babylonjs/havok';

async function initEngine() {
    // Localiser et charger le fichier .wasm de Havok
    const wasmPath = path.resolve('./node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm');
    const wasmBinary = fs.readFileSync(wasmPath);
    
    // Initialiser l'instance Havok et la lier là où Babylon la cherche
    const havok = await HavokPhysics({ wasmBinary });
    global.HK = havok; // Babylon cherche souvent HK en global par défaut pour Havok

    // 5. Importer dynamiquement votre script contenant la scène
    // (En supposant que votre code est sauvegardé sous le nom 'carScene.js')
    const { default: createScene } = await import('./carScene.js');

    console.log("Initialisation de la scène Babylon avec Havok...");
    
    // Passer le canvas simulé à la fonction
    const scene = await createScene(canvas); 

    console.log("Scène créée avec succès !");

    // Exemple : Exécuter la boucle de rendu manuellement pendant quelques secondes
    let frames = 0;
    const interval = setInterval(() => {
        scene.getEngine()._renderLoop();
        frames++;
        if (frames % 100 === 0) {
            console.log(`Simulation en cours... Frame: ${frames}`);
        }
        
        // Arrêt de la démo après 500 frames
        if (frames > 500) {
            clearInterval(interval);
            console.log("Fin de la simulation headless.");
            process.exit(0);
        }
    }, 1000 / 60); // 60 FPS simulé
}

initEngine().catch(console.error);
