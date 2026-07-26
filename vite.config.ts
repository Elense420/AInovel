import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import express from 'express';
import dotenv from 'dotenv';
import { handleChatCompletionRequest, handleModelsRequest } from './src/server/aiRouter';

dotenv.config();

function apiServerPlugin(): Plugin {
  return {
    name: 'api-server-plugin',
    configureServer(server) {
      const app = express();
      app.use(express.json({ limit: '10mb' }));

      app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', serverTime: new Date().toISOString() });
      });

      app.get('/api/ai/models', handleModelsRequest as any);
      app.post('/api/ai/chat', handleChatCompletionRequest as any);

      server.middlewares.use(app as any);
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), apiServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
