/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

// BASE_PATH setzt der Showcase-Hub beim Build (z. B. /car-interior). Ohne: relative Pfade, läuft überall.
const basePath = process.env.BASE_PATH?.replace(/\/$/, '')
const base = basePath ? `${basePath}/` : './'

/*
  Schriften des ersten Bildschirms (Startsprache Georgisch, Überschriften in Unbounded) mit dem HTML
  anfordern. Ohne Preload kommen sie erst über das CSS und springen nach dem ersten Rendern ein –
  das verschiebt das Cockpit-Bild (Lighthouse: CLS ~0,1).
*/
const HERO_FONTS = [
  /unbounded-latin-500-normal/,
  /unbounded-latin-700-normal/,
  /manrope-latin-400-normal/,
  /manrope-latin-600-normal/,
  /noto-sans-georgian-georgian-400-normal/,
  /noto-sans-georgian-georgian-600-normal/,
]

function preloadHeroFonts(): Plugin {
  return {
    name: 'preload-hero-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {}).filter((f) => f.endsWith('.woff2') && HERO_FONTS.some((re) => re.test(f)))
        return files.map((f) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `${base}${f}`, crossorigin: '' },
          injectTo: 'head-prepend' as const,
        }))
      },
    },
  }
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), preloadHeroFonts()],
  // `npm run dev` + server on :8787: one origin for the app, the API, media and the MCP/OAuth endpoints
  server: {
    proxy: Object.fromEntries(['/api', '/media', '/mcp', '/oauth', '/.well-known', '/authorize', '/token', '/register', '/revoke']
      .map((p) => [p, { target: process.env.API_PROXY ?? 'http://localhost:8787', changeOrigin: false }])),
  },
  test: { include: ['src/**/*.test.ts'] },
})
