import type { Request, Response } from 'express';
import { createClient } from 'webdav';

function getWebdavClient(serverUrl: string, username?: string, password?: string) {
  if (!serverUrl) {
    throw new Error('WebDAV 服务器地址不能为空');
  }

  let url = serverUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  return createClient(url, {
    username: username || '',
    password: password || '',
  });
}

const BACKUP_DIR = '/AINovelistBackups';

/**
 * Test WebDAV Connection
 */
export async function handleWebdavTest(req: Request, res: Response) {
  try {
    const { webdavUrl, username, password } = req.body || {};
    const client = getWebdavClient(webdavUrl, username, password);

    // Test directory access
    const exists = await client.exists('/');
    if (!exists) {
      return res.status(400).json({ error: '无法访问 WebDAV 根目录，请检查 URL 地址' });
    }

    // Try checking/creating backup directory
    const dirExists = await client.exists(BACKUP_DIR);
    if (!dirExists) {
      try {
        await client.createDirectory(BACKUP_DIR);
      } catch (err: any) {
        console.warn('Could not auto-create backup directory:', err?.message);
      }
    }

    return res.json({
      success: true,
      message: '✅ 成功连接至 WebDAV 服务器 (如坚果云)！备份目录准备就绪。',
    });
  } catch (error: any) {
    console.error('WebDAV Test Error:', error);
    return res.status(400).json({
      error: `WebDAV 连接失败: ${error.message || '请检查账号密码或服务器地址'}`,
    });
  }
}

/**
 * Backup All App Data to WebDAV
 */
export async function handleWebdavBackup(req: Request, res: Response) {
  try {
    const { webdavUrl, username, password, backupData, customName } = req.body || {};
    if (!backupData) {
      return res.status(400).json({ error: '没有提供需要备份的数据' });
    }

    const client = getWebdavClient(webdavUrl, username, password);

    // Ensure directory exists
    const dirExists = await client.exists(BACKUP_DIR);
    if (!dirExists) {
      await client.createDirectory(BACKUP_DIR);
    }

    const now = new Date();
    const timeStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = customName ? `${customName}.json` : `ai_novelist_backup_${timeStr}.json`;
    const targetPath = `${BACKUP_DIR}/${fileName}`;
    const latestPath = `${BACKUP_DIR}/latest_backup.json`;

    const jsonStr = JSON.stringify(backupData, null, 2);

    // Save timestamped file & latest file
    await client.putFileContents(targetPath, jsonStr, { overwrite: true });
    await client.putFileContents(latestPath, jsonStr, { overwrite: true });

    return res.json({
      success: true,
      fileName,
      path: targetPath,
      timestamp: now.toISOString(),
      message: `✅ 已成功将完整数据备份至坚果云/WebDAV (${fileName})！`,
    });
  } catch (error: any) {
    console.error('WebDAV Backup Error:', error);
    return res.status(500).json({
      error: `备份失败: ${error.message || '请检查 WebDAV 配置及网络'}`,
    });
  }
}

/**
 * List Backups on WebDAV
 */
export async function handleWebdavList(req: Request, res: Response) {
  try {
    const { webdavUrl, username, password } = req.body || {};
    const client = getWebdavClient(webdavUrl, username, password);

    let items: any[] = [];
    const dirExists = await client.exists(BACKUP_DIR);

    if (dirExists) {
      const contents = await client.getDirectoryContents(BACKUP_DIR);
      if (Array.isArray(contents)) {
        items = contents;
      }
    } else {
      // Fallback check root
      const rootContents = await client.getDirectoryContents('/');
      if (Array.isArray(rootContents)) {
        items = rootContents.filter((i: any) => i.filename.endsWith('.json'));
      }
    }

    const files = items
      .filter((item: any) => item.type === 'file' && item.basename.endsWith('.json'))
      .map((item: any) => ({
        basename: item.basename,
        filename: item.filename,
        size: item.size,
        lastmod: item.lastmod,
      }))
      .sort((a, b) => new Date(b.lastmod).getTime() - new Date(a.lastmod).getTime());

    return res.json({
      success: true,
      files,
    });
  } catch (error: any) {
    console.error('WebDAV List Error:', error);
    return res.status(500).json({
      error: `获取备份列表失败: ${error.message || '请检查 WebDAV 配置'}`,
    });
  }
}

/**
 * Restore Backup from WebDAV
 */
export async function handleWebdavRestore(req: Request, res: Response) {
  try {
    const { webdavUrl, username, password, fileName } = req.body || {};
    if (!fileName) {
      return res.status(400).json({ error: '未指定要恢复的备份文件名' });
    }

    const client = getWebdavClient(webdavUrl, username, password);
    const filePath = fileName.startsWith('/') ? fileName : `${BACKUP_DIR}/${fileName}`;

    const exists = await client.exists(filePath);
    if (!exists) {
      return res.status(404).json({ error: `指定备份文件不存在: ${fileName}` });
    }

    const fileContent = await client.getFileContents(filePath, { format: 'text' });

    let backupData: any = null;
    try {
      backupData = typeof fileContent === 'string' ? JSON.parse(fileContent) : JSON.parse(fileContent.toString());
    } catch (e) {
      return res.status(400).json({ error: '备份文件内容格式损坏或无法解析为 JSON' });
    }

    return res.json({
      success: true,
      fileName,
      backupData,
      message: '✅ 备份文件读取成功，准备恢复数据！',
    });
  } catch (error: any) {
    console.error('WebDAV Restore Error:', error);
    return res.status(500).json({
      error: `从 WebDAV 恢复备份失败: ${error.message || '请检查网络或文件状态'}`,
    });
  }
}
