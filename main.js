import * as BABYLON from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { initBlockly, runBlocklyCode, stopBlocklyCode, resetBlocklyWorkspace } from './blockly_setup.js';

// Rendre BABYLON accessible globalement pour carScene.js qui l'utilise ainsi
window.BABYLON = BABYLON;

async function init() {
    // Initialiser Havok Physics (le WASM est chargé automatiquement dans un navigateur)
    const havokInstance = await HavokPhysics();
    window.HK = havokInstance;

    // Initialiser Blockly
    initBlockly();

    // Exposer les fonctions de contrôle Blockly globalement
    window.runBlockly = runBlocklyCode;
    window.stopBlockly = stopBlocklyCode;
    window.resetBlockly = resetBlocklyWorkspace;

    // Importer dynamiquement la scène (elle a besoin de BABYLON en global)
    const { default: createScene } = await import('./carScene.js');

    const canvas = document.getElementById('renderCanvas');

    // Créer la scène
    const scene = await createScene(canvas);

    console.log('Scène créée avec succès !');

    // Lancer la boucle de rendu
    const engine = scene.getEngine();
    engine.runRenderLoop(() => scene.render());

    // Redimensionnement adaptatif
    window.addEventListener('resize', () => engine.resize());
}

init().catch(console.error);
