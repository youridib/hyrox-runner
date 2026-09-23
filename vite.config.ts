import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'fonts/*.woff2', 'apple-touch-icon.png'],
      manifest: {
        name: 'Hyrox Runner',
        short_name: 'Hyrox',
        description: 'Evidence-based Hyrox running planner',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0a0b',
        theme_color: '#0a0a0b',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Domain tests run in node; UI tests opt into a DOM per file.
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
});
