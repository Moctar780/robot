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
            // ── Labyrinthe très simple ──
            // Murs extérieurs
            { type: 'box', x: 0, z: -105, width: 210, height: 3, depth: 1 },
            { type: 'box', x: 0, z: 105, width: 210, height: 3, depth: 1 },
            { type: 'box', x: -105, z: 0, width: 1, height: 3, depth: 210 },
            { type: 'box', x: 105, z: 0, width: 1, height: 3, depth: 210 },
            // Quelques séparateurs
            { type: 'box', x: 0, z: -50, width: 100, height: 3, depth: 1 },
            { type: 'box', x: 0, z: 50, width: 100, height: 3, depth: 1 },
            { type: 'box', x: -50, z: 0, width: 1, height: 3, depth: 100 },
            { type: 'box', x: 50, z: 0, width: 1, height: 3, depth: 100 },
            // ── Départ (vert) ──
            { type: 'box', x: -90, z: 90, width: 6, height: 0.5, depth: 6, color: [0, 0.8, 0] },
            // ── Arrivée (or) ──
            { type: 'box', x: 90, z: -90, width: 6, height: 0.5, depth: 6, color: [1, 0.8, 0] },
        ],
    },
];
