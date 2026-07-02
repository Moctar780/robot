// ── Création de la scène principale ──
import { setEngine, setScene, setHavokInstance } from './context.js';
import { vehicleType } from './globals.js';
import { setupKeyboardListener } from './controls.js';
import { InitTyreMaterial } from './materials.js';
import { applyEnvironment } from './environment.js';
import { CreateCar } from './car.js';
import { CreateRover } from './rover.js';

function CreateVehicle(type) {
    return type === 'rover' ? CreateRover() : CreateCar();
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

    const camera = new BABYLON.FollowCamera('FollowCam', new BABYLON.Vector3(0, 10, -10), scene);
    camera.radius = 50;
    camera.heightOffset = 20;
    camera.rotationOffset = 180;
    camera.cameraAcceleration = 0.035;
    camera.maxCameraSpeed = 10;

    const light = new BABYLON.HemisphericLight('Light', new BABYLON.Vector3(1, 1, 0), scene);
    light.intensity = 0.7;

    InitTyreMaterial();
    setupKeyboardListener();

    const vType = (typeof vehicleType !== 'undefined' && vehicleType) || 'car';
    const vehicle = CreateVehicle(vType);
    camera.lockedTarget = vehicle;

    engine.runRenderLoop(() => {
        if (scene && scene.activeCamera) scene.render();
    });

    return scene;
}
