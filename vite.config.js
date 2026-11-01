import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@dimforge/rapier3d-compat')) return 'rapier-physics';
          if (id.includes('node_modules/three')) return 'three-renderer';
        }
      }
    }
  },
  server: { host: true }
});