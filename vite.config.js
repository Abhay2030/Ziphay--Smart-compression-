import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'frontend',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'frontend/index.html'),
        dashboard: resolve(__dirname, 'frontend/dashboard.html'),
        tools: resolve(__dirname, 'frontend/tools.html'),
        converter: resolve(__dirname, 'frontend/converter.html'),
        about: resolve(__dirname, 'frontend/about.html'),
        blog: resolve(__dirname, 'frontend/blog.html'),
        contact: resolve(__dirname, 'frontend/contact.html'),
        privacy: resolve(__dirname, 'frontend/privacy.html'),
        terms: resolve(__dirname, 'frontend/terms.html'),
        security: resolve(__dirname, 'frontend/security.html'),
        status: resolve(__dirname, 'frontend/status.html'),
        cookies: resolve(__dirname, 'frontend/cookies.html'),
        changelog: resolve(__dirname, 'frontend/changelog.html'),
        notFound: resolve(__dirname, 'frontend/404.html')
      }
    }
  }
});
