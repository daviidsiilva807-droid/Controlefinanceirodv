import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png', 'splash/*.png'],
      manifest: {
        id: '/',
        name: 'Controle Financeiro',
        short_name: 'Finanças',
        description: 'Controle de gastos, orçamento e cartões — para você e sua família.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f172a',
        theme_color: '#059669',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Novo lançamento', short_name: 'Lançar', url: '/lancamentos/novo' },
          { name: 'Cartões', short_name: 'Cartões', url: '/cartoes' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/index.html',
        // As chamadas ao Supabase nunca são servidas do cache: dado financeiro
        // desatualizado é pior do que a tela dizer que está offline.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false, // o service worker só entra no build; use `npm run preview`
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Separar as bibliotecas grandes em chunks próprios faz o service
        // worker revalidar só o que mudou: editar uma tela do app não
        // invalida os 400 kB do Recharts no cache do celular.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          graficos: ['recharts'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
})
