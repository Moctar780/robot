import * as BABYLON from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { initBlockly, runBlocklyCode, stopBlocklyCode, resetBlocklyWorkspace } from './blockly_setup.js';
// import { startCameraControl, stopCameraControl, isCameraActive } from './core/camera_control.js';  // caméra désactivée

// Rendre BABYLON accessible globalement pour carScene.js qui l'utilise ainsi
window.BABYLON = BABYLON;

let currentScene = null;
let currentEngine = null;

async function init() {
    // Initialiser Havok Physics
    const havokInstance = await HavokPhysics();
    window.HK = havokInstance;

    // Initialiser Blockly
    initBlockly();

    // Exposer les fonctions de contrôle Blockly globalement
    window.runBlockly = runBlocklyCode;
    window.stopBlockly = stopBlocklyCode;
    window.resetBlockly = resetAll;

    // Exposer les fonctions de changement d'environnement/véhicule
    window.switchEnv = switchEnv;
    window.switchVehicle = switchVehicle;
    window.toggleCam = toggleCam;
    // window.toggleCamera = toggleCamera;  // caméra désactivée

    // Créer la scène initiale
    await createNewScene();

    // Redimensionnement (un seul écouteur)
    window.addEventListener('resize', () => {
        if (currentEngine) currentEngine.resize();
    });
}

async function createNewScene() {
    // Nettoyer l'ancienne scène
    if (currentScene) {
        if (currentEngine) currentEngine.stopRenderLoop();
        currentScene.dispose();
        currentScene = null;
        currentEngine = null;
    }

    const canvas = document.getElementById('renderCanvas');
    const { createScene } = await import('./core/index.js');
    currentScene = await createScene(canvas);
    currentEngine = currentScene.getEngine();

    console.log('Scène créée avec succès !');

    // Lancer la boucle de rendu
    if (currentScene && currentEngine) {
        const scene = currentScene;
        currentEngine.runRenderLoop(() => {
            if (scene && scene.activeCamera) scene.render();
        });
    }
}

function switchEnv(index) {
    document.querySelectorAll('#envMenu button').forEach(b => b.classList.remove('active'));
    document.querySelector(`#envMenu button[data-index="${index}"]`)?.classList.add('active');
    if (window.switchEnvironment) {
        window.switchEnvironment(index);
    }
}
function switchVehicle(type) {
    document.querySelectorAll('#vehicleMenu button').forEach(b => b.classList.remove('active'));
    document.querySelector(`#vehicleMenu button[data-vehicle="${type}"]`)?.classList.add('active');
    if (window.setVehicleType) window.setVehicleType(type);
    createNewScene();
}

function toggleCam() {
    const btn = document.getElementById('camBtn');
    import('./core/scene.js').then(m => {
        const mode = m.toggleCameraMode();
        btn.textContent = mode === 'follow' ? '🎥 Suivi' : '🎥 Libre';
    });
}

function resetAll() {
    resetBlocklyWorkspace();
    import('./core/context.js').then(ctx => {
        if (window.switchEnvironment) {
            window.switchEnvironment(ctx.currentEnvIndex);
        }
    });
}

init().catch(console.error);
