import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { handleChatCompletionRequest, handleModelsRequest } from './src/server/aiRouter';
import {
  handleWebdavTest,
  handleWebdavBackup,
  handleWebdavList,
  handleWebdavRestore,
} from './src/server/webdavRouter';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  app.get('/api/ai/models', handleModelsRequest as any);
  app.post('/api/ai/chat', handleChatCompletionRequest as any);

  // WebDAV Routes
  app.post('/api/webdav/test', handleWebdavTest as any);
  app.post('/api/webdav/backup', handleWebdavBackup as any);
  app.post('/api/webdav/list', handleWebdavList as any);
  app.post('/api/webdav/restore', handleWebdavRestore as any);

  // Catch-all for unhandled /api requests to return JSON 404 instead of HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `未知 API 路由: ${req.method} ${req.path}` });
  });

  // Serve Vite in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Novelist server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

