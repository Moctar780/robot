// ── Gestion des environnements ──
import { scene, pushEnvMesh, pushEnvObstacle, resetEnvMeshes, resetEnvObstacles, setCurrentEnvIndex } from './context.js';
import { AddStaticPhysics } from './physics.js';
import { ENVIRONMENTS } from '../environments.js';
import '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/OBJ';

let skyboxMesh = null;
let currentEnvTexture = null;
let loadedModels = [];

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

    // ── Skybox ──
    if (skyboxMesh) { skyboxMesh.dispose(); skyboxMesh = null; }
    if (env.skyboxTexture) {
        try {
            const cubeTex = new BABYLON.CubeTexture(env.skyboxTexture, scene);
            cubeTex.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
            skyboxMesh = BABYLON.MeshBuilder.CreateBox('skyBox', { size: 1000 }, scene);
            skyboxMesh.sideOrientation = BABYLON.Mesh.BACKSIDE;
            const mat = new BABYLON.StandardMaterial('skyBoxMat', scene);
            mat.backFaceCulling = false;
            mat.reflectionTexture = cubeTex;
            mat.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
            mat.disableLighting = true;
            skyboxMesh.material = mat;
            skyboxMesh.isPickable = false;
            skyboxMesh.infiniteDistance = true;
        } catch (e) {
            console.warn('Skybox non chargée :', e.message);
        }
    }

    // ── IBL (environmentTexture pour PBR) ──
    if (currentEnvTexture) { currentEnvTexture.dispose(); currentEnvTexture = null; }
    if (env.envTexture) {
        try {
            currentEnvTexture = new BABYLON.CubeTexture(env.envTexture, scene);
            scene.environmentTexture = currentEnvTexture;
        } catch (e) {
            console.warn('IBL non chargée :', e.message);
        }
    } else {
        scene.environmentTexture = null;
    }

    // ── Brouillard ──
    if (env.fog) {
        scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
        scene.fogColor = new BABYLON.Color3(...env.fogColor);
        scene.fogDensity = env.fogDensity || 0.005;
    } else {
        scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
    }

    // ── Fond (couleur de secours) ──
    scene.clearColor = new BABYLON.Color3(...env.skyColor);

    // ── Sol ──
    if (!env.skipGround) {
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
        if (env.hideGround) ground.visibility = 0;
        window.__envMeshes.push(ground);
    }

    // ── Murs ──
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

    // ── Obstacles ──
    const obsMat = new BABYLON.StandardMaterial('ObsMat', scene);
    obsMat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
    const accentMat = new BABYLON.StandardMaterial('AccentMat', scene);
    accentMat.diffuseColor = new BABYLON.Color3(0.9, 0.4, 0.1);

    for (const obs of env.obstacles) {
        let m;
        if (obs.type === 'model') {
            // Chargé plus tard via loadEnvironmentModels
            continue;
        } else if (obs.type === 'building') {
            m = createBuilding(obs);
        } else if (obs.type === 'bump') {
            m = BABYLON.MeshBuilder.CreateCylinder('Bump', { height: obs.height, diameter: obs.size * 2 });
            m.position = new BABYLON.Vector3(obs.x, obs.height / 2 - 10, obs.z);
            m.material = obsMat;
        } else if (obs.type === 'ramp') {
            m = BABYLON.MeshBuilder.CreateBox('Ramp', { width: obs.width, height: obs.height, depth: obs.depth });
            m.position = new BABYLON.Vector3(obs.x, obs.height / 2 - 10, obs.z);
            m.rotation.x = 0.3;
            m.bakeCurrentTransformIntoVertices();
            m.material = accentMat;
        } else if (obs.type === 'box') {
            m = BABYLON.MeshBuilder.CreateBox('ObsBox', { width: obs.width, height: obs.height, depth: obs.depth });
            m.position = new BABYLON.Vector3(obs.x, obs.height / 2 - 10, obs.z);
            if (obs.color) {
                const mat = new BABYLON.StandardMaterial('BoxMat', scene);
                mat.diffuseColor = new BABYLON.Color3(...obs.color);
                m.material = mat;
            } else {
                m.material = obsMat;
            }
        }
        if (m) {
            AddStaticPhysics(m, env.friction, env.restitution);
            window.__envObstacles.push(m);
        }
    }
}

/** Crée un bâtiment procédural avec fenêtres */
function createBuilding(obs) {
    const w = obs.width ?? 4;
    const h = obs.height ?? 6;
    const d = obs.depth ?? 4;
    const color = obs.color ?? [0.4, 0.35, 0.3];
    const roofColor = obs.roofColor ?? [0.5, 0.2, 0.1];

    const parent = new BABYLON.TransformNode('Building', scene);

    // Corps du bâtiment (avec physique)
    const body = BABYLON.MeshBuilder.CreateBox('Body', { width: w, height: h, depth: d }, scene);
    const bodyMat = new BABYLON.StandardMaterial('BodyMat', scene);
    bodyMat.diffuseColor = new BABYLON.Color3(...color);
    body.material = bodyMat;
    body.parent = parent;

    // Toit
    const roof = BABYLON.MeshBuilder.CreateBox('Roof', {
        width: w + 0.3, height: 0.3, depth: d + 0.3
    }, scene);
    const roofMat = new BABYLON.StandardMaterial('RoofMat', scene);
    roofMat.diffuseColor = new BABYLON.Color3(...roofColor);
    roof.material = roofMat;
    roof.position.y = h / 2 + 0.15;
    roof.parent = parent;

    // Fenêtres
    const winMat = new BABYLON.StandardMaterial('WinMat', scene);
    winMat.diffuseColor = new BABYLON.Color3(0.9, 0.85, 0.5);
    winMat.emissiveColor = new BABYLON.Color3(0.3, 0.25, 0.1);
    const rows = Math.max(1, Math.floor(h / 2));
    const cols = Math.max(1, Math.floor(w / 1.5));
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const win = BABYLON.MeshBuilder.CreatePlane('Win', {
                width: 0.6, height: 0.8
            }, scene);
            win.material = winMat;
            win.position.set(
                (c - (cols - 1) / 2) * 1.2,
                (r - (rows - 1) / 2) * 1.3 + 0.5,
                d / 2 + 0.01
            );
            win.parent = parent;
        }
    }

    parent.position = new BABYLON.Vector3(obs.x, obs.height / 2 - 10, obs.z);
    parent.computeWorldMatrix(true);

    // Physique sur le corps principal
    AddStaticPhysics(body, 300, 0);

    return parent;
}

/** Charge les modèles 3D (.glb) d'un environnement */
export async function loadEnvironmentModels(index) {
    // Nettoyer les anciens modèles
    for (const m of loadedModels) {
        m.physicsBody?.dispose();
        m.dispose();
    }
    loadedModels = [];

    const env = ENVIRONMENTS[index];

    for (const obs of env.obstacles) {
        if (obs.type !== 'model' || !obs.file) continue;

        try {
            // Déterminer le root URL (dossier contenant le fichier)
            const parts = obs.file.split('/');
            const fileName = parts.pop();
            const rootUrl = obs.rootUrl ?? ('/models/' + (parts.length ? parts.join('/') + '/' : ''));

            const result = await BABYLON.SceneLoader.ImportMeshAsync(
                '', rootUrl, fileName, scene,
            );
            const root = result.meshes[0];
            root.position = new BABYLON.Vector3(obs.x, obs.y ?? -10, obs.z);
            root.scaling = new BABYLON.Vector3(
                obs.scale ?? 1, obs.scale ?? 1, obs.scale ?? 1
            );
            if (obs.rotation) {
                root.rotation = new BABYLON.Vector3(
                    obs.rotation.x ?? 0, obs.rotation.y ?? 0, obs.rotation.z ?? 0
                );
            }

            // Physique seulement si demandé (modèle sert de sol)
            if (obs.physics) {
                AddStaticPhysics(root, env.friction, env.restitution);
            }
            loadedModels.push(root);
            window.__envObstacles.push(root);
            console.log(`✅ Modèle décoratif chargé : ${obs.file}`);
        } catch (e) {
            console.warn(`⚠️ Échec chargement ${obs.file}:`, e.message);
        }
    }
}

// Redéfinir switchEnvironment pour charger aussi les modèles
window.switchEnvironment = (index) => {
    if (!scene || index < 0 || index >= ENVIRONMENTS.length) return;
    applyEnvironment(index);
    loadEnvironmentModels(index);
};
