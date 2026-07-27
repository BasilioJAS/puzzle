import { defineConfig } from 'vite';

export default defineConfig({
    base: process.env.VITE_BASE || '/puzzle/',
    root: '.',
    publicDir: 'public',
    server: {
        port: 3000,
        open: true
    },
    build: {
        outDir: 'dist',
        sourcemap: true
    }
});
