import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vercel serves from the domain root; GitHub Pages serves from /Helett-SCM-Test/.
  // Vercel sets the VERCEL env var during its build, so this picks the right base automatically.
  base: process.env.VERCEL ? '/' : '/Helett-SCM-Test/',
})