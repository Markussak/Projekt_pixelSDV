import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 3000,
    host: true, // Allow access from mobile devices
    open: true,
    hmr: {
      overlay: true
    }
  },
  preview: {
    port: 3001,
    host: true
  },
  resolve: {
    alias: {
      '@': '/src',
      '@core': '/src/core',
      '@entities': '/src/entities',
      '@ui': '/src/ui',
      '@utils': '/src/utils',
      '@procedural': '/src/procedural',
      '@managers': '/src/managers',
      '@systems': '/src/systems',
      '@rendering': '/src/rendering',
      '@items': '/src/items',
      '@inventory': '/src/inventory',
      '@crafting': '/src/crafting',
      '@combat': '/src/combat',
      '@rpg': '/src/rpg',
      '@diplomacy': '/src/diplomacy',
      '@ai': '/src/ai',
      '@audio': '/src/audio',
      '@effects': '/src/effects',
      '@optimization': '/src/optimization',
      '@assets': '/src/assets'
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  css: {
    devSourcemap: true
  },
  optimizeDeps: {
    include: ['matter-js', 'howler', 'simplex-noise']
  }
})