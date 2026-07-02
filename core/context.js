// ── Contexte partagé de la scène ──
// Centralise les références utilisées par tous les modules.

/** @type {BABYLON.Engine} */
export let engine = null;
/** @type {BABYLON.Scene} */
export let scene = null;
/** @type {BABYLON.HavokPlugin} */
export let havokInstance = null;

export function setEngine(e) { engine = e; }
export function setScene(s) { scene = s; }
export function setHavokInstance(h) { havokInstance = h; }

// Références pour le changement d'environnement
export let envMeshes = [];
export let envObstacles = [];
export let currentEnvIndex = 0;

export function resetEnvMeshes() { envMeshes = []; }
export function resetEnvObstacles() { envObstacles = []; }
export function pushEnvMesh(m) { envMeshes.push(m); }
export function pushEnvObstacle(o) { envObstacles.push(o); }
export function setCurrentEnvIndex(i) { currentEnvIndex = i; }
