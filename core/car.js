// ── Création de la voiture ──
import { scene } from './context.js';
import { debugColours, FILTERS } from './globals.js';
import { AddDynamicPhysics, AddAxlePhysics, AddWheelPhysics, AddStaticPhysics, FilterMeshCollisions } from './physics.js';
import { InitKeyboardControls } from './controls.js';
import { tyreMaterial } from './materials.js';

export function CreateCar() {
    const frame = BABYLON.MeshBuilder.CreateBox('Frame', { height: 1, width: 12, depth: 24, faceColors: debugColours });
    frame.position = new BABYLON.Vector3(0, 0.3, 0);
    frame.visibility = 0.5;
    const frameBody = AddDynamicPhysics(frame, 1000, 0, 0);
    FilterMeshCollisions(frame);

    const flW = CreateWheel(new BABYLON.Vector3(5, 0, 8));
    const flA = CreateAxle(new BABYLON.Vector3(5, 0, 8));
    const frW = CreateWheel(new BABYLON.Vector3(-5, 0, 8));
    const frA = CreateAxle(new BABYLON.Vector3(-5, 0, 8));
    const rlW = CreateWheel(new BABYLON.Vector3(5, 0, -8));
    const rlA = CreateAxle(new BABYLON.Vector3(5, 0, -8));
    const rrW = CreateWheel(new BABYLON.Vector3(-5, 0, -8));
    const rrA = CreateAxle(new BABYLON.Vector3(-5, 0, -8));

    for (const m of [flA, frA, rlA, rrA]) {
        frame.addChild(m);
        AddAxlePhysics(m, 100, 0, 0);
        FilterMeshCollisions(m);
    }
    for (const m of [flW, frW, rlW, rrW]) {
        AddWheelPhysics(m, 100, 0.1, 50);
        FilterMeshCollisions(m);
    }

    const motorA = CreatePoweredWheelJoint(flA, flW);
    const motorB = CreatePoweredWheelJoint(frA, frW);
    CreateWheelJoint(rlA, rlW);
    CreateWheelJoint(rrA, rrW);

    const steerA = AttachAxleToFrame(flA.physicsBody, frameBody, true);
    const steerB = AttachAxleToFrame(frA.physicsBody, frameBody, true);
    AttachAxleToFrame(rlA.physicsBody, frameBody);
    AttachAxleToFrame(rrA.physicsBody, frameBody);

    InitKeyboardControls(motorA, motorB, steerA, steerB);

    window._carMesh = frame;
    window.robotResetTracking();
    return frame;
}

function CreateAxle(position) {
    const m = BABYLON.MeshBuilder.CreateBox('Axle', { height: 1, width: 2.5, depth: 1, faceColors: debugColours });
    m.position = position;
    return m;
}

function CreateWheel(position) {
    const uv = [
        new BABYLON.Vector4(0, 0, 0, 0),
        new BABYLON.Vector4(0, 1, 1, 0),
        new BABYLON.Vector4(0, 0, 0, 0),
    ];
    const m = BABYLON.MeshBuilder.CreateCylinder('Wheel', { height: 1.6, diameter: 4, faceUV: uv });
    m.rotation = new BABYLON.Vector3(0, 0, Math.PI / 2);
    m.bakeCurrentTransformIntoVertices();
    m.position = position;
    m.material = tyreMaterial;
    return m;
}

function AttachAxleToFrame(axle, frame, hasSteering) {
    const pos = axle.transformNode.position;
    const j = new BABYLON.Physics6DoFConstraint(
        { pivotA: BABYLON.Vector3.Zero(), pivotB: new BABYLON.Vector3(pos.x, pos.y, pos.z) },
        [
            { axis: BABYLON.PhysicsConstraintAxis.LINEAR_X, minLimit: 0, maxLimit: 0 },
            { axis: BABYLON.PhysicsConstraintAxis.LINEAR_Y, minLimit: -0.15, maxLimit: 0.15, stiffness: 100000, damping: 5000 },
            { axis: BABYLON.PhysicsConstraintAxis.LINEAR_Z, minLimit: 0, maxLimit: 0 },
            { axis: BABYLON.PhysicsConstraintAxis.ANGULAR_X, minLimit: -0.25, maxLimit: 0.25 },
            { axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Y, minLimit: hasSteering ? null : 0, maxLimit: hasSteering ? null : 0 },
            { axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Z, minLimit: -0.05, maxLimit: 0.05 },
        ],
        scene
    );
    axle.addConstraint(frame, j);
    if (hasSteering) AttachSteering(j);
    return j;
}

function CreateWheelJoint(axle, wheel) {
    const j = new BABYLON.Physics6DoFConstraint(
        {},
        [
            { axis: BABYLON.PhysicsConstraintAxis.LINEAR_DISTANCE, minLimit: 0, maxLimit: 0 },
            { axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Y, minLimit: 0, maxLimit: 0 },
            { axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Z, minLimit: 0, maxLimit: 0 },
        ],
        scene
    );
    axle.addChild(wheel);
    axle.physicsBody.addConstraint(wheel.physicsBody, j);
    return j;
}

function CreatePoweredWheelJoint(axle, wheel) {
    const j = CreateWheelJoint(axle, wheel);
    j.setAxisMotorType(BABYLON.PhysicsConstraintAxis.ANGULAR_X, BABYLON.PhysicsConstraintMotorType.VELOCITY);
    j.setAxisMotorMaxForce(BABYLON.PhysicsConstraintAxis.ANGULAR_X, 180000);
    j.setAxisMotorTarget(BABYLON.PhysicsConstraintAxis.ANGULAR_X, 0);
    return j;
}

function AttachSteering(joint) {
    joint.setAxisMotorType(BABYLON.PhysicsConstraintAxis.ANGULAR_Y, BABYLON.PhysicsConstraintMotorType.POSITION);
    joint.setAxisMotorMaxForce(BABYLON.PhysicsConstraintAxis.ANGULAR_Y, 30000000);
    joint.setAxisMotorTarget(BABYLON.PhysicsConstraintAxis.ANGULAR_Y, 0);
    return joint;
}

/** Déplace la voiture à une position donnée (utilisé par le labyrinthe) */
export function teleportCar(x, z) {
    const car = window._carMesh;
    if (!car) return;
    const body = car.physicsBody;
    if (body) {
        body.disablePreStep = true;
        car.position.x = x;
        car.position.z = z;
        body.syncWithPhysicsEngine();
        body.disablePreStep = false;
        body.setLinearVelocity(BABYLON.Vector3.Zero());
        body.setAngularVelocity(BABYLON.Vector3.Zero());
    } else {
        car.position.x = x;
        car.position.z = z;
    }
    window.robotResetTracking?.();
}
