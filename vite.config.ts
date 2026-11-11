/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// BASE_PATH setzt der Showcase-Hub beim Build (z. B. /car-interior). Ohne: relative Pfade, läuft überall.
const basePath = process.env.BASE_PATH?.replace(/\/$/, '')

export default defineConfig({
  base: basePath ? `${basePath}/` : './',
  plugins: [react(), tailwindcss()],
  test: { include: ['src/**/*.test.ts'] },
})
