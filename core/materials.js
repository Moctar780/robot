// ── Matériaux ──
import { scene } from './context.js';

export let tyreMaterial = null;

export function InitTyreMaterial() {
    tyreMaterial = new BABYLON.StandardMaterial('Tyre', scene);
    const tex = new BABYLON.Texture('textures/up.png', scene);
    tex.wAng = -Math.PI / 2;
    tex.vScale = 0.4;
    tyreMaterial.diffuseTexture = tex;
}
