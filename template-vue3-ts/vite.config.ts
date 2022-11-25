import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Define from 'unplugin-vue-define-options/vite'
import {} from 'unplugin-vue-components/resolvers'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      reactivityTransform: true
    }),
    vueJsx(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dirs: ['./hooks'],
      dts: './auto-imports.d.ts',
      resolvers: [],
      eslintrc: {
        enabled: false,
        filepath: './.eslintrc-auto-import.json'
      }
    }),
    Components({
      dirs: ['src/components'],
      extensions: ['vue'],
      deep: true,
      resolvers: [],
      dts: './components.d.ts'
    }),
    Define()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
