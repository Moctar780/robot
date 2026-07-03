// ──────────────────────────────────────────────
// Définitions des environnements physiques
// ──────────────────────────────────────────────
// Données pures — pas de dépendance à BABYLON ici.

// Textures HDRI / skybox disponibles sur le CDN Babylon.js
const CDN = 'https://assets.babylonjs.com';

export const ENVIRONMENTS = [
    {
        name: 'Démo',
        icon: '🕺',
        groundColor: [0.75, 0.75, 0.7],
        groundTexture: null,
        groundTextureScale: 1,
        friction: 300,
        restitution: 0,
        wallColor: [0.6, 0.6, 0.6],
        skyColor: [0.6, 0.8, 1.0],
        skyboxTexture: 'textures/skybox2',
        envTexture: `${CDN}/core/environments/environmentSpecular.env`,
        fog: false,
        fogColor: [0.6, 0.8, 1.0],
        fogDensity: 0.003,
        obstacles: [],
    },
    // Ville, Circuit, Désert, Slalom désactivés
    {
        name: 'Labyrinthe',
        icon: '🌀',
        groundColor: [0.2, 0.2, 0.22],
        groundTexture: null,
        groundTextureScale: 1,
        friction: 300,
        restitution: 0,
        wallColor: [0.6, 0.3, 0.1],
        skyColor: [0.5, 0.7, 0.9],
        skyboxTexture: `${CDN}/core/environments/backgroundSkybox.dds`,
        envTexture: `${CDN}/core/environments/environmentSpecular.env`,
        fog: false,
        fogColor: [0.5, 0.7, 0.9],
        fogDensity: 0.004,
        obstacles: [
            // ── Grand labyrinthe (×3) ──
            // Murs extérieurs
            { type: 'box', x: 0, z: -105, width: 210, height: 3, depth: 1 },
            { type: 'box', x: 0, z: 105, width: 210, height: 3, depth: 1 },
            { type: 'box', x: -105, z: 0, width: 1, height: 3, depth: 210 },
            { type: 'box', x: 105, z: 0, width: 1, height: 3, depth: 210 },
            // Lignes horizontales (axe Z)
            { type: 'box', x: -75, z: -75, width: 60, height: 3, depth: 1 },
            { type: 'box', x: 30, z: -75, width: 45, height: 3, depth: 1 },
            { type: 'box', x: -45, z: -45, width: 90, height: 3, depth: 1 },
            { type: 'box', x: 60, z: -45, width: 30, height: 3, depth: 1 },
            { type: 'box', x: -75, z: -15, width: 60, height: 3, depth: 1 },
            { type: 'box', x: 15, z: -15, width: 30, height: 3, depth: 1 },
            { type: 'box', x: 75, z: -15, width: 30, height: 3, depth: 1 },
            { type: 'box', x: -30, z: 15, width: 60, height: 3, depth: 1 },
            { type: 'box', x: 60, z: 15, width: 30, height: 3, depth: 1 },
            { type: 'box', x: -75, z: 45, width: 45, height: 3, depth: 1 },
            { type: 'box', x: 15, z: 45, width: 60, height: 3, depth: 1 },
            { type: 'box', x: -45, z: 75, width: 90, height: 3, depth: 1 },
            // Lignes verticales (axe X)
            { type: 'box', x: -75, z: -90, width: 1, height: 3, depth: 30 },
            { type: 'box', x: -75, z: -60, width: 1, height: 3, depth: 30 },
            { type: 'box', x: -30, z: -90, width: 1, height: 3, depth: 30 },
            { type: 'box', x: 30, z: -60, width: 1, height: 3, depth: 30 },
            { type: 'box', x: 75, z: -90, width: 1, height: 3, depth: 30 },
            { type: 'box', x: -45, z: -30, width: 1, height: 3, depth: 30 },
            { type: 'box', x: 45, z: -30, width: 1, height: 3, depth: 30 },
            { type: 'box', x: -75, z: 0, width: 1, height: 3, depth: 30 },
            { type: 'box', x: 75, z: 0, width: 1, height: 3, depth: 30 },
            { type: 'box', x: -90, z: 30, width: 1, height: 3, depth: 30 },
            { type: 'box', x: 45, z: 30, width: 1, height: 3, depth: 30 },
            { type: 'box', x: -75, z: 60, width: 1, height: 3, depth: 30 },
            { type: 'box', x: 75, z: 60, width: 1, height: 3, depth: 30 },
            // ── Départ (vert) ──
            { type: 'box', x: -90, z: 90, width: 6, height: 0.5, depth: 6, color: [0, 0.8, 0] },
            // ── Arrivée (or) ──
            { type: 'box', x: 90, z: -90, width: 6, height: 0.5, depth: 6, color: [1, 0.8, 0] },
        ],
    },
];
