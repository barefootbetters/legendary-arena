import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// why: build.sourcemap is enabled so that first-time bootstrap failures are
// diagnosable against the original TypeScript / Vue source rather than the
// minified bundle. Revisit in a future packet once the app grows and the
// sourcemap size becomes a production concern.
export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
});
