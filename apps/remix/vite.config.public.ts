import { lingui } from '@lingui/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import autoprefixer from 'autoprefixer';
import serverAdapter from 'hono-react-router-adapter/vite';
import path from 'node:path';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import macrosPlugin from 'vite-plugin-babel-macros';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Configuración para desarrollo público accesible desde internet
 * Usa host: '0.0.0.0' para permitir conexiones externas
 */
export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  server: {
    host: '0.0.0.0', // ← Permite acceso desde cualquier IP
    port: 3000,
    strictPort: true,
    hmr: {
      host: 'xubuntu-server.duckdns.org',
      port: 3000,
    },
    origin: 'http://xubuntu-server.duckdns.org:3000',
    cors: true, // ← Habilita CORS para acceso externo
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  },
  plugins: [
    reactRouter(),
    macrosPlugin(),
    lingui(),
    tsconfigPaths(),
    serverAdapter({
      entry: 'server/router.ts',
    }),
  ],
  ssr: {
    noExternal: ['react-dropzone', 'plausible-tracker', 'pdfjs-dist'],
    external: [
      '@node-rs/bcrypt',
      '@prisma/client',
      '@documenso/tailwind-config',
      'playwright',
      'playwright-core',
      '@playwright/browser-chromium',
    ],
  },
  optimizeDeps: {
    entries: ['./app/**/*', '../../packages/ui/**/*', '../../packages/lib/**/*'],
    include: ['prop-types', 'file-selector', 'attr-accept'],
    exclude: [
      'node_modules',
      '@node-rs/bcrypt',
      '@documenso/pdf-sign',
      'sharp',
      'playwright',
      'playwright-core',
      '@playwright/browser-chromium',
    ],
  },
  resolve: {
    alias: {
      https: 'node:https',
      '.prisma/client/default': path.resolve(
        __dirname,
        '../../node_modules/.prisma/client/default.js',
      ),
      '.prisma/client/index-browser': path.resolve(
        __dirname,
        '../../node_modules/.prisma/client/index-browser.js',
      ),
      canvas: path.resolve(__dirname, './app/types/empty-module.ts'),
    },
  },
  build: {
    rollupOptions: {
      external: [
        '@node-rs/bcrypt',
        '@documenso/pdf-sign',
        '@aws-sdk/cloudfront-signer',
        'nodemailer',
        /playwright/,
        '@playwright/browser-chromium',
      ],
    },
  },
});
