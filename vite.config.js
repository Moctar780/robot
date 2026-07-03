import { defineConfig } from "vite";

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  // prevent vite from obscuring rust errors
  clearScreen: false,
  build: {
    // Code splitting pour réduire la taille des chunks
    rollupOptions: {
      output: {
        manualChunks: {
          babylon: ["@babylonjs/core"],
          havok: ["@babylonjs/havok"],
          blockly: ["blockly"],
        },
      },
    },
    // Avertir seulement pour les très gros chunks
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
