import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Production builds load their files from cdn.<domain>. Local runs use the same address as the page.
  base: process.env.VITE_BASE_URL ?? '/',
})
