import { defineConfig } from "vite";

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  // prevent vite from obscuring rust errors
  clearScreen: false,
  build: {
    // Code splitting pour réduire la taille des chunks
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@babylonjs/core')) return 'babylon';
          if (id.includes('@babylonjs/havok')) return 'havok';
          if (id.includes('blockly')) return 'blockly';
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
