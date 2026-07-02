// ── Création du rover ──
import { scene } from './context.js';
import { setupRoverControls } from './controls.js';

export function CreateRover() {
    const group = new BABYLON.TransformNode('RoverGroup');

    // Corps
    const body = BABYLON.MeshBuilder.CreateBox('Body', { height: 1.2, width: 6, depth: 10 });
    body.position = new BABYLON.Vector3(0, 0.6, 0);
    body.parent = group;

    // Panneau solaire
    const panel = BABYLON.MeshBuilder.CreateBox('Panel', { height: 0.1, width: 7, depth: 11 });
    panel.position = new BABYLON.Vector3(0, 1.25, 0);
    panel.parent = group;

    // Mât + capteur
    const mast = BABYLON.MeshBuilder.CreateCylinder('Mast', { height: 2, diameter: 0.2 });
    mast.position = new BABYLON.Vector3(0, 2.3, 0);
    mast.parent = group;
    const sensor = BABYLON.MeshBuilder.CreateSphere('Sensor', { diameter: 0.6 });
    sensor.position = new BABYLON.Vector3(0, 3.4, 0);
    sensor.parent = group;

    // 6 roues
    const wPos = [
        [3.5, 3.5], [-3.5, 3.5], [3.5, 0],
        [-3.5, 0], [3.5, -3.5], [-3.5, -3.5],
    ];
    for (const [x, z] of wPos) {
        const w = BABYLON.MeshBuilder.CreateCylinder('W', { height: 1, diameter: 2.5 });
        w.rotation = new BABYLON.Vector3(0, 0, Math.PI / 2);
        w.bakeCurrentTransformIntoVertices();
        w.position = new BABYLON.Vector3(x, 0, z);
        w.parent = group;
    }

    // Fusion
    const merged = BABYLON.Mesh.MergeMeshes(group.getChildMeshes(), true, true);
    merged.position = new BABYLON.Vector3(0, 1.5, 0);
    merged.name = 'Rover';

    // Physique
    const shape = new BABYLON.PhysicsShapeBox(
        BABYLON.Vector3.Zero(), BABYLON.Quaternion.Identity(),
        new BABYLON.Vector3(6, 1.5, 10), scene
    );
    const physicsBody = new BABYLON.PhysicsBody(merged, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
    physicsBody.setMassProperties({ mass: 600 });
    shape.material = { restitution: 0.1, friction: 50 };
    physicsBody.shape = shape;

    setupRoverControls(merged, physicsBody);

    window._carMesh = merged;
    window.robotResetTracking();
    return merged;
}
