import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// En desarrollo, /api va al backend local (cd backend && npm start). En Vercel, a la función api/.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': process.env.VITE_API_PROXY ?? 'http://localhost:8000' },
  },
})
