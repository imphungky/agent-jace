import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API calls to the future Python backend during development, so the
    // frontend can call `/api/...` with no CORS setup. Point this at wherever
    // the Python API ends up listening (FastAPI/Flask default shown here).
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
