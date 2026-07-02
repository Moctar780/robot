// ── Gestion des environnements ──
import { scene, pushEnvMesh, pushEnvObstacle, resetEnvMeshes, resetEnvObstacles, setCurrentEnvIndex } from './context.js';
import { AddStaticPhysics } from './physics.js';
import { ENVIRONMENTS } from '../environments.js';

export function applyEnvironment(index) {
    // Nettoyer l'ancien environnement
    for (const m of [...window.__envMeshes || [], ...window.__envObstacles || []]) {
        m.physicsBody?.dispose();
        m.dispose();
    }
    window.__envMeshes = [];
    window.__envObstacles = [];

    resetEnvMeshes();
    resetEnvObstacles();

    const env = ENVIRONMENTS[index];
    setCurrentEnvIndex(index);

    // Fond
    scene.clearColor = new BABYLON.Color3(...env.skyColor);

    // Sol
    const groundMat = new BABYLON.StandardMaterial('GroundMat', scene);
    groundMat.diffuseColor = new BABYLON.Color3(...env.groundColor);
    if (env.groundTexture) {
        const tex = new BABYLON.Texture(env.groundTexture, scene);
        tex.uScale = env.groundTextureScale;
        tex.vScale = env.groundTextureScale;
        groundMat.diffuseTexture = tex;
    }
    const ground = BABYLON.MeshBuilder.CreateGround('Ground', { height: 500, width: 500 });
    ground.material = groundMat;
    ground.position = new BABYLON.Vector3(0, -10, 0);
    AddStaticPhysics(ground, env.friction, env.restitution);
    window.__envMeshes.push(ground);

    // Murs
    const wallMat = new BABYLON.StandardMaterial('WallMat', scene);
    wallMat.diffuseColor = new BABYLON.Color3(...env.wallColor);
    const defs = [
        { x: 0, z: 250, w: 500, d: 1 },
        { x: 0, z: -250, w: 500, d: 1 },
        { x: 250, z: 0, w: 1, d: 500 },
        { x: -250, z: 0, w: 1, d: 500 },
    ];
    for (const d of defs) {
        const w = BABYLON.MeshBuilder.CreateBox('Wall', { height: 20, width: d.w, depth: d.d });
        w.position = new BABYLON.Vector3(d.x, 0, d.z);
        w.material = wallMat;
        AddStaticPhysics(w, env.friction, env.restitution);
        window.__envMeshes.push(w);
    }

    // Obstacles
    for (const obs of env.obstacles) {
        let m;
        if (obs.type === 'bump') {
            m = BABYLON.MeshBuilder.CreateCylinder('Bump', { height: obs.height, diameter: obs.size * 2 });
            m.position = new BABYLON.Vector3(obs.x, obs.height / 2 - 10, obs.z);
        } else if (obs.type === 'ramp') {
            m = BABYLON.MeshBuilder.CreateBox('Ramp', { width: obs.width, height: obs.height, depth: obs.depth });
            m.position = new BABYLON.Vector3(obs.x, obs.height / 2 - 10, obs.z);
            m.rotation.x = 0.3;
            m.bakeCurrentTransformIntoVertices();
        } else if (obs.type === 'box') {
            m = BABYLON.MeshBuilder.CreateBox('ObsBox', { width: obs.width, height: obs.height, depth: obs.depth });
            m.position = new BABYLON.Vector3(obs.x, obs.height / 2 - 10, obs.z);
        }
        if (m) {
            AddStaticPhysics(m, env.friction, env.restitution);
            window.__envObstacles.push(m);
        }
    }
}

window.switchEnvironment = (index) => {
    if (!scene || index < 0 || index >= ENVIRONMENTS.length) return;
    applyEnvironment(index);
};
