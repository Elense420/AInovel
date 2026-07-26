import { WebdavConfig } from '../types';
import { exportAllAppData, importAllAppData } from './db';

export async function testWebdavConnection(config: WebdavConfig) {
  const res = await fetch('/api/webdav/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '测试 WebDAV 连接失败');
  }
  return data;
}

export async function backupToWebdav(config: WebdavConfig, customName?: string) {
  const backupData = await exportAllAppData();

  const res = await fetch('/api/webdav/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...config,
      backupData,
      customName,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'WebDAV 备份失败');
  }
  return data;
}

export async function listWebdavBackups(config: WebdavConfig) {
  const res = await fetch('/api/webdav/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '获取 WebDAV 备份列表失败');
  }
  return data.files as Array<{
    basename: string;
    filename: string;
    size: number;
    lastmod: string;
  }>;
}

export async function restoreFromWebdav(config: WebdavConfig, fileName: string) {
  const res = await fetch('/api/webdav/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...config,
      fileName,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'WebDAV 恢复数据失败');
  }

  if (!data.backupData) {
    throw new Error('未获取到有效的备份数据');
  }

  // Restore into IndexedDB
  await importAllAppData(data.backupData);

  return data;
}
