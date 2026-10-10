import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'safargo-backend-middleware',
      apply: 'serve', // Only runs during 'vite' dev, excluded from production build
      async configureServer(server) {
        try {
          const { default: app } = await import('./server/app.js');
          const { initSocketServer } = await import('./server/socket.js');
          server.middlewares.use(app);
          if (server.httpServer) {
            try {
              initSocketServer(server.httpServer);
            } catch (err) {
              console.warn('[Vite Socket.IO]', err.message);
            }
          }
        } catch (err) {
          console.warn('[Vite Dev Middleware]', err.message);
        }
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: false,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
