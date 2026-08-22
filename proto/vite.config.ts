import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// base './' => el build anda igual en localhost, en /puzzle/proto/ o en cualquier subcarpeta
export default defineConfig({
    root: here,
    base: './',
    publicDir: resolve(here, 'public'),
    server: { host: true, port: 5174, strictPort: false },
    preview: { host: true, port: 5175 },
    build: {
        outDir: resolve(here, '../dist-proto'),
        emptyOutDir: true,
        target: 'es2020',
        rollupOptions: {
            input: {
                main: resolve(here, 'index.html'),
                editor: resolve(here, 'editor.html'),
                ears: resolve(here, 'ears.html'),
            },
        },
    },
});
