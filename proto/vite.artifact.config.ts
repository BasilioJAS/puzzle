import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Build de una sola entrada (solo el juego) para poder empaquetarlo en un
// único HTML autocontenido. Ver tools/bundle_artifact.py
export default defineConfig({
    root: here,
    base: './',
    publicDir: resolve(here, 'public'),
    build: {
        outDir: resolve(here, '../dist-artifact'),
        emptyOutDir: true,
        target: 'es2020',
        cssCodeSplit: false,
        rollupOptions: {
            input: { main: resolve(here, 'index.html') },
            output: { inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app.[ext]' },
        },
    },
});
