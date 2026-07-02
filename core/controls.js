// ── Contrôles clavier et véhicules ──
import { scene } from './context.js';
import { targetSpeed, targetSteeringAngle, setTargetSpeed, setTargetSteeringAngle } from './globals.js';
import { CalculateWheelAngles } from './physics.js';

// État interne du clavier
let forwardPressed = false, backPressed = false;
let leftPressed = false, rightPressed = false;
let brakePressed = false;
const maxSpeed = 150;
const maxSteeringAngle = Math.PI / 6;

/** Met en place les écouteurs clavier (commun aux deux véhicules) */
export function setupKeyboardListener() {
    scene.onKeyboardObservable.add(e => {
        const down = e.type === BABYLON.KeyboardEventTypes.KEYDOWN;
        switch (e.event.key) {
            case 'w': case 'W': case 'ArrowUp': forwardPressed = down; break;
            case 's': case 'S': case 'ArrowDown': backPressed = down; break;
            case 'a': case 'A': case 'ArrowLeft': leftPressed = down; break;
            case 'd': case 'D': case 'ArrowRight': rightPressed = down; break;
            case ' ': brakePressed = down; break;
        }
    });

    // Appliquer le clavier aux globaux targetSpeed / targetSteeringAngle
    scene.onBeforeRenderObservable.add(() => {
        if (!forwardPressed && !backPressed && !leftPressed && !rightPressed && !brakePressed) return;
        if (leftPressed) setTargetSteeringAngle(targetSteeringAngle + 0.01);
        else if (rightPressed) setTargetSteeringAngle(targetSteeringAngle - 0.01);
        else if (!leftPressed && !rightPressed) setTargetSteeringAngle(targetSteeringAngle * 0.98);
        if (brakePressed) setTargetSpeed(0);
        else if (forwardPressed) setTargetSpeed(Math.min(targetSpeed + 8, maxSpeed));
        else if (backPressed) setTargetSpeed(Math.max(targetSpeed - 8, -maxSpeed * 0.5));
        else if (!forwardPressed && !backPressed) setTargetSpeed(targetSpeed * 0.99);
    });
}

/** Applique targetSpeed/targetSteeringAngle aux joints moteur/direction (voiture) */
export function InitKeyboardControls(motorWheelA, motorWheelB, steerWheelA, steerWheelB) {
    scene.onBeforeRenderObservable.add(() => {
        const [inner, outer] = CalculateWheelAngles(targetSteeringAngle);
        steerWheelA.setAxisMotorTarget(BABYLON.PhysicsConstraintAxis.ANGULAR_Y, inner);
        steerWheelB.setAxisMotorTarget(BABYLON.PhysicsConstraintAxis.ANGULAR_Y, outer);
        motorWheelA.setAxisMotorTarget(BABYLON.PhysicsConstraintAxis.ANGULAR_X, targetSpeed);
        motorWheelB.setAxisMotorTarget(BABYLON.PhysicsConstraintAxis.ANGULAR_X, targetSpeed);

        // Suivi de distance/angle
        updateTracking();
    });
}

/** Met à jour le suivi accumulé (distance et angle) */
export function updateTracking() {
    const mesh = window._carMesh;
    if (!mesh || !window.robotTrackingInitialized) return;

    let angle = 0;
    if (mesh.rotationQuaternion) {
        angle = mesh.rotationQuaternion.toEulerAngles().y;
    } else {
        angle = mesh.rotation.y;
    }
    let deltaA = angle - window.robotLastAngle;
    while (deltaA > Math.PI) deltaA -= 2 * Math.PI;
    while (deltaA < -Math.PI) deltaA += 2 * Math.PI;
    window.robotAccumulatedAngle += Math.abs(deltaA);
    window.robotLastAngle = angle;

    const dx = mesh.position.x - window.robotLastPos.x;
    const dz = mesh.position.z - window.robotLastPos.z;
    window.robotAccumulatedDistance += Math.sqrt(dx * dx + dz * dz);
    window.robotLastPos.x = mesh.position.x;
    window.robotLastPos.z = mesh.position.z;
}

/** Contrôle spécifique du rover (vélocité linéaire/angulaire) */
export function setupRoverControls(mesh, physicsBody) {
    scene.onBeforeRenderObservable.add(() => {
        const forward = mesh.forward;

        // Vélocité linéaire
        const curVel = physicsBody.getLinearVelocity();
        const tgtVel = forward.scale(targetSpeed * 0.15);
        physicsBody.setLinearVelocity(curVel.add(tgtVel.subtract(curVel).scale(0.1)));

        // Vélocité angulaire
        const curAng = physicsBody.getAngularVelocity();
        const tgtAng = new BABYLON.Vector3(0, targetSteeringAngle * 0.5, 0);
        physicsBody.setAngularVelocity(curAng.add(tgtAng.subtract(curAng).scale(0.08)));

        updateTracking();
    });
}
