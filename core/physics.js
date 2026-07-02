// ── Fonctions d'ajout de physique ──
import { scene } from './context.js';
import { FILTERS } from './globals.js';

export function AddWheelPhysics(mesh, mass, bounce, friction) {
    const shape = new BABYLON.PhysicsShapeCylinder(
        new BABYLON.Vector3(-0.8, 0, 0), new BABYLON.Vector3(0.8, 0, 0), 2, scene
    );
    const body = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
    body.setMassProperties({ mass });
    shape.material = { restitution: bounce, friction };
    body.shape = shape;
    return body;
}

export function AddAxlePhysics(mesh, mass, bounce, friction) {
    const shape = new BABYLON.PhysicsShapeCylinder(
        new BABYLON.Vector3(-0.8, 0, 0), new BABYLON.Vector3(0.8, 0, 0), 1.8, scene
    );
    const body = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
    body.setMassProperties({ mass });
    shape.material = { restitution: bounce, friction };
    body.shape = shape;
    return body;
}

export function AddDynamicPhysics(mesh, mass, bounce, friction) {
    const shape = new BABYLON.PhysicsShapeMesh(mesh, scene);
    const body = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
    body.setMassProperties({ mass });
    shape.material = { restitution: bounce, friction };
    body.shape = shape;
    return body;
}

export function AddStaticPhysics(mesh, friction, restitution) {
    const shape = new BABYLON.PhysicsShapeMesh(mesh, scene);
    const body = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.STATIC, false, scene);
    shape.material = { restitution: restitution || 0, friction };
    body.shape = shape;
    return body;
}

export function FilterMeshCollisions(mesh) {
    mesh.physicsBody.shape.filterMembershipMask = FILTERS.CarParts;
    mesh.physicsBody.shape.filterCollideMask = FILTERS.Environment;
}

export function CalculateWheelAngles(averageAngle) {
    const wheelbase = 16;
    const trackWidth = 11;
    if (Math.abs(averageAngle) < 0.001) return [0, 0];
    const avgRadius = wheelbase / Math.tan(averageAngle);
    const innerRadius = avgRadius - trackWidth / 2;
    const outerRadius = avgRadius + trackWidth / 2;
    const innerAngle = Math.atan(wheelbase / innerRadius);
    const outerAngle = Math.atan(wheelbase / outerRadius);
    return [innerAngle, outerAngle];
}
