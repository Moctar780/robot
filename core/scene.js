// ── Création de la scène principale ──
import { setEngine, setScene, setHavokInstance, scene } from './context.js';
import { vehicleType } from './globals.js';
import { setupKeyboardListener } from './controls.js';
import { InitTyreMaterial } from './materials.js';
import { applyEnvironment } from './environment.js';
import { CreateCar } from './car.js';
import { ENVIRONMENTS } from '../environments.js';
// import { CreateRover } from './rover.js';  // rover désactivé

let followCamera = null;
let freeCamera = null;
let currentCamMode = 'follow';

function CreateVehicle(type) {
    return CreateCar();  // rover désactivé
}

export function toggleCameraMode() {
    if (!scene) return;
    if (currentCamMode === 'follow') {
        freeCamera.attachControl(true);
        scene.activeCamera = freeCamera;
        currentCamMode = 'free';
        return 'free';
    } else {
        freeCamera.detachControl();
        scene.activeCamera = followCamera;
        currentCamMode = 'follow';
        return 'follow';
    }
}

export function getCameraMode() {
    return currentCamMode;
}

export default async function createScene(canvas) {
    const engine = new BABYLON.Engine(canvas);
    const scene = new BABYLON.Scene(engine);
    setEngine(engine);
    setScene(scene);

    const havok = new BABYLON.HavokPlugin(false);
    setHavokInstance(havok);

    scene.enablePhysics(new BABYLON.Vector3(0, -240, 0), havok);
    scene.getPhysicsEngine().setTimeStep(1 / 500);
    scene.getPhysicsEngine().setSubTimeStep(4.5);

    applyEnvironment(0);

    // Caméra suivi (FollowCamera)
    followCamera = new BABYLON.FollowCamera('FollowCam', new BABYLON.Vector3(0, 10, -10), scene);
    followCamera.radius = 50;
    followCamera.heightOffset = 20;
    followCamera.rotationOffset = 180;
    followCamera.cameraAcceleration = 0.035;
    followCamera.maxCameraSpeed = 10;

    // Caméra libre (ArcRotateCamera) — orbite 3D
    freeCamera = new BABYLON.ArcRotateCamera('FreeCam', -Math.PI / 4, Math.PI / 4, 80, new BABYLON.Vector3(0, 0, 0), scene);
    freeCamera.lowerRadiusLimit = 5;
    freeCamera.upperRadiusLimit = 300;
    freeCamera.lowerBetaLimit = 0.05;
    freeCamera.upperBetaLimit = Math.PI / 2.2;
    freeCamera.panningSensibility = 50;
    freeCamera.wheelPrecision = 5;
    freeCamera.angularSensibilityX = 500;
    freeCamera.angularSensibilityY = 500;

    const light = new BABYLON.HemisphericLight('Light', new BABYLON.Vector3(1, 1, 0), scene);
    light.intensity = 0.7;

    InitTyreMaterial();
    setupKeyboardListener();

    const vType = (typeof vehicleType !== 'undefined' && vehicleType) || 'car';
    const vehicle = CreateVehicle(vType);
    followCamera.lockedTarget = vehicle;
    scene.activeCamera = followCamera;

    engine.runRenderLoop(() => {
        if (scene && scene.activeCamera) scene.render();
    });

    return scene;
}
