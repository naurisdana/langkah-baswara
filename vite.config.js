import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = String(env.VITE_API_URL || env.VITE_API_BASE || '').replace(/\/+$/, '')

  return {
    plugins: [react()],
    server: {
      // Browser memanggil /api di origin yang sama, Vite yang meneruskan ke backend.
      // CORS backend hanya membuka localhost:5173, jadi port lain ikut bisa memuat data.
      proxy: target
        ? {
            '/api': {
              target,
              changeOrigin: true,
              headers: target.includes('ngrok')
                ? { 'ngrok-skip-browser-warning': 'true' }
                : undefined,
            },
          }
        : undefined,
    },
  }
})
