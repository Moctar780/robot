// ── Création de la scène principale ──
import { setEngine, setScene, setHavokInstance, scene } from './context.js';
import { vehicleType } from './globals.js';
import { setupKeyboardListener } from './controls.js';
import { InitTyreMaterial } from './materials.js';
import { applyEnvironment } from './environment.js';
import { CreateCar } from './car.js';
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
        scene.activeCamera = freeCamera;
        currentCamMode = 'free';
        return 'free';
    } else {
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

    // Caméra libre (ArcRotateCamera)
    freeCamera = new BABYLON.ArcRotateCamera('FreeCam', 0, Math.PI / 3, 80, new BABYLON.Vector3(0, 0, 0), scene);
    freeCamera.lowerRadiusLimit = 10;
    freeCamera.upperRadiusLimit = 200;
    freeCamera.panningSensibility = 1;
    freeCamera.keysUp = [];
    freeCamera.keysDown = [];
    freeCamera.keysLeft = [];
    freeCamera.keysRight = [];

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
