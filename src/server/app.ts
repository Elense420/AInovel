import express from 'express';
import dotenv from 'dotenv';
import { handleChatCompletionRequest, handleModelsRequest } from './aiRouter';
import {
  handleWebdavTest,
  handleWebdavBackup,
  handleWebdavList,
  handleWebdavRestore,
} from './webdavRouter';

dotenv.config();

const app = express();

app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// AI Routes
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

export default app;
