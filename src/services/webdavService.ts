import { WebdavConfig } from '../types';
import { exportAllAppData, importAllAppData } from './db';

async function safeFetchJson(url: string, options: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err: any) {
    throw new Error(`网络请求失败，无法连接至后端服务器: ${err.message || err}`);
  }

  const text = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `服务器未返回有效 JSON 格式数据 (${res.status} ${res.statusText})。请检查后端服务是否正在运行。`
    );
  }

  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data;
}

export async function testWebdavConnection(config: WebdavConfig) {
  return await safeFetchJson('/api/webdav/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}

export async function backupToWebdav(config: WebdavConfig, customName?: string) {
  const backupData = await exportAllAppData();

  return await safeFetchJson('/api/webdav/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...config,
      backupData,
      customName,
    }),
  });
}

export async function listWebdavBackups(config: WebdavConfig) {
  const data = await safeFetchJson('/api/webdav/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  return (data.files || []) as Array<{
    basename: string;
    filename: string;
    size: number;
    lastmod: string;
  }>;
}

export async function restoreFromWebdav(config: WebdavConfig, fileName: string) {
  const data = await safeFetchJson('/api/webdav/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...config,
      fileName,
    }),
  });

  if (!data.backupData) {
    throw new Error('未获取到有效的备份数据');
  }

  // Restore into IndexedDB
  await importAllAppData(data.backupData);

  return data;
}

