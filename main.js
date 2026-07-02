import * as BABYLON from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { initBlockly, runBlocklyCode, stopBlocklyCode, resetBlocklyWorkspace } from './blockly_setup.js';
import { startCameraControl, stopCameraControl, isCameraActive } from './core/camera_control.js';

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
    window.resetBlockly = resetBlocklyWorkspace;

    // Exposer les fonctions de changement d'environnement/véhicule
    window.switchEnv = switchEnv;
    window.switchVehicle = switchVehicle;
    window.toggleCamera = toggleCamera;

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
function toggleCamera() {
    const btn = document.getElementById('cameraBtn');
    if (isCameraActive()) {
        stopCameraControl();
        btn.classList.remove('active');
        btn.textContent = '📷 Caméra';
    } else {
        startCameraControl();
        btn.classList.add('active');
        btn.textContent = '📷 Arrêter';
    }
}

function switchVehicle(type) {
    document.querySelectorAll('#vehicleMenu button').forEach(b => b.classList.remove('active'));
    document.querySelector(`#vehicleMenu button[data-vehicle="${type}"]`)?.classList.add('active');
    if (window.setVehicleType) window.setVehicleType(type);
    createNewScene();
}

init().catch(console.error);
