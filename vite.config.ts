/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// BASE_PATH setzt der Showcase-Hub beim Build (z. B. /car-interior). Ohne: relative Pfade, läuft überall.
const basePath = process.env.BASE_PATH?.replace(/\/$/, '')

export default defineConfig({
  base: basePath ? `${basePath}/` : './',
  plugins: [react(), tailwindcss()],
  // `npm run dev` + server on :8787: one origin for the app, the API, media and the MCP/OAuth endpoints
  server: {
    proxy: Object.fromEntries(['/api', '/media', '/mcp', '/oauth', '/.well-known', '/authorize', '/token', '/register', '/revoke']
      .map((p) => [p, { target: process.env.API_PROXY ?? 'http://localhost:8787', changeOrigin: false }])),
  },
  test: { include: ['src/**/*.test.ts'] },
})
