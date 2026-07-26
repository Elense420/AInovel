import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { handleChatCompletionRequest, handleModelsRequest } from './src/server/aiRouter';
import {
  handleWebdavTest,
  handleWebdavBackup,
  handleWebdavList,
  handleWebdavRestore,
} from './src/server/webdavRouter';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

app.get('/api/ai/models', handleModelsRequest as any);
app.post('/api/ai/chat', handleChatCompletionRequest as any);

// WebDAV Backup Routes
app.post('/api/webdav/test', handleWebdavTest as any);
app.post('/api/webdav/backup', handleWebdavBackup as any);
app.post('/api/webdav/list', handleWebdavList as any);
app.post('/api/webdav/restore', handleWebdavRestore as any);

const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
