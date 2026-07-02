// ── API globale pour Blockly et suivi ──

// Variables de contrôle (lues par les callbacks des véhicules)
export let targetSpeed = 0;
export let targetSteeringAngle = 0;
export let vehicleType = 'car';

export function setTargetSpeed(s) { targetSpeed = s; }
export function setTargetSteeringAngle(a) { targetSteeringAngle = a; }
export function setVehicleType(t) { vehicleType = t; }

// Exposées sur window pour Blockly
window.setRobotSpeed = (s) => { targetSpeed = s; };
window.getRobotSpeed = () => targetSpeed;
window.setRobotSteering = (a) => { targetSteeringAngle = a; };

// ── Suivi de position/distance pour les blocs Blockly ──

/** @type {BABYLON.AbstractMesh} */
window._carMesh = null;

window.robotAccumulatedDistance = 0;
window.robotAccumulatedAngle = 0;
window.robotLastPos = { x: 0, z: 0 };
window.robotLastAngle = 0;
window.robotTrackingInitialized = false;

window.robotGetDistanceTraveled = () => window.robotAccumulatedDistance || 0;
window.robotGetAngleTurned = () => window.robotAccumulatedAngle || 0;

window.robotResetTracking = () => {
    const mesh = window._carMesh;
    if (!mesh) return;
    let angle = 0;
    if (mesh.rotationQuaternion) {
        angle = mesh.rotationQuaternion.toEulerAngles().y;
    } else {
        angle = mesh.rotation.y;
    }
    window.robotAccumulatedDistance = 0;
    window.robotAccumulatedAngle = 0;
    window.robotLastPos = { x: mesh.position.x, z: mesh.position.z };
    window.robotLastAngle = angle;
    window.robotTrackingInitialized = true;
};

// Constantes partagées
export const FILTERS = { CarParts: 1, Environment: 2 };

export const debugColours = [
    new BABYLON.Color3(1, 0, 1),
    new BABYLON.Color3(1, 0, 0),
    new BABYLON.Color3(0, 1, 0),
    new BABYLON.Color3(1, 1, 0),
    new BABYLON.Color3(0, 1, 1),
    new BABYLON.Color3(0, 0, 1),
];

// Exposé pour que main.js puisse changer le type
window.getVehicleType = () => vehicleType;
window.setVehicleType = (t) => { vehicleType = t; };
