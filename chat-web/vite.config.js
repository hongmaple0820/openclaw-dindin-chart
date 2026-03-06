import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // 自动导入 Vue API (ref, computed, watch 等) 和 ElementPlus API
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      resolvers: [
        ElementPlusResolver(),
        // 自动导入图标组件
        IconsResolver({ prefix: 'Icon' }),
      ],
      dts: 'src/auto-imports.d.ts',
    }),
    // 自动注册组件 (包括 ElementPlus 组件按需引入)
    Components({
      resolvers: [
        ElementPlusResolver({ importStyle: 'css' }),
        // 自动注册图标组件 (i-ep-Setting -> <i-ep-setting />)
        IconsResolver({ enabledCollections: ['ep'] }),
      ],
      dts: 'src/components.d.ts',
    }),
    // 图标自动导入插件
    Icons({
      autoInstall: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5273,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8273',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8273',
        ws: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-utils': ['axios', 'marked', 'dompurify'],
          'vendor-echarts': ['echarts']
        }
      }
    }
  }
});