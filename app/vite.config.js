import { defineConfig } from 'vite';

// In productie (GitHub Pages) draait de app onder /ons-weekmenu/.
// In dev (npm run dev) onder /. Mode wordt door Vite-CLI bepaald.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/ons-weekmenu/' : '/',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
}));
