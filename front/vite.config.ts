import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/*
 * Desarrollo (F0, respuesta 6 de Ivan): el proxy redirige /api/* al backend
 * y quita el prefijo. El navegador ve un solo sitio (localhost:5173), así
 * que la cookie SameSite=Strict de la sesión viaja sin CORS. El prefijo evita
 * el choque entre las rutas del front y las de la API (/acceso, /casos...).
 * Cómo se sirve en producción se decide en F5.
 *
 * BACKEND_DESARROLLO (opcional, solo desarrollo y fuera de .env.example):
 * dirección del backend para el proxy; por defecto http://localhost:3000.
 */
export default defineConfig(({ mode }) => {
  const entorno = loadEnv(mode, '.', '');
  const backend = entorno['BACKEND_DESARROLLO'] ?? 'http://localhost:3000';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: false,
          rewrite: (ruta) => ruta.replace(/^\/api/, ''),
        },
      },
    },
  };
});
