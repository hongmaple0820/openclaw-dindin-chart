/**
 * 文件上传/下载路由
 */

import express, { type Request, type Response } from 'express';
import { FileStorage } from '../api/file-storage';

const router = express.Router();

// 初始化文件存储
const fileStorage = new FileStorage();

interface InitUploadBody {
  name: string;
  size: number;
  type?: string;
}

interface UploadInfo {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
}

interface ChunkResult {
  uploadedChunks: number[];
  isComplete: boolean;
}

interface ProgressInfo {
  uploadId: string;
  uploadedChunks: number[];
  totalChunks: number;
  progress: number;
}

interface FileListResult {
  files: unknown[];
  total: number;
  page: number;
  limit: number;
}

interface DownloadInfo {
  headers: Record<string, string>;
  stream: Buffer;
}

// 初始化分片上传
router.post('/upload/init', async (req: Request<object, object, InitUploadBody>, res: Response): Promise<void> => {
  try {
    const { name, size, type } = req.body;
    
    if (!name || !size) {
      res.status(400).json({ error: 'Missing required fields: name, size' });
      return;
    }
    
    const uploadInfo = await fileStorage.initUpload({
      name,
      size,
      type
    }) as UploadInfo;
    
    res.json({
      success: true,
      data: uploadInfo
    });
  } catch (error) {
    console.error('[Files] Init upload failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// 上传分片
router.put('/upload/:id/chunk/:index', async (req: Request<{ id: string; index: string }>, res: Response): Promise<void> => {
  try {
    const { id: uploadId } = req.params;
    const { index } = req.params;
    const chunkIndex = parseInt(index);
    
    if (isNaN(chunkIndex) || chunkIndex < 0) {
      res.status(400).json({ error: 'Invalid chunk index' });
      return;
    }
    
    const chunkData = req.body;
    const chunkHash = req.headers['x-chunk-hash'] as string | undefined; // 可选的分片哈希校验
    
    const result = await fileStorage.uploadChunk(uploadId, chunkIndex, chunkData, chunkHash) as ChunkResult;
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Files] Upload chunk failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// 查询上传进度
router.get('/upload/:id/progress', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id: uploadId } = req.params;
    
    const progress = await fileStorage.getProgress(uploadId) as ProgressInfo;
    
    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('[Files] Get progress failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// 完成分片上传
router.post('/upload/:id/complete', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id: uploadId } = req.params;
    
    const result = await fileStorage.completeUpload(uploadId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Files] Complete upload failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// 下载文件
router.get('/:id/download', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id: fileId } = req.params;
    const range = req.headers.range;
    
    const downloadInfo = await fileStorage.downloadFile(fileId, range) as DownloadInfo;
    
    if (range) {
      res.status(206); // Partial Content
    } else {
      res.status(200);
    }
    
    // 设置响应头
    Object.entries(downloadInfo.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    // 发送文件流
    res.send(downloadInfo.stream);
  } catch (error) {
    console.error('[Files] Download failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取文件列表
router.get('/', async (req: Request<object, object, object, { page?: string; limit?: string }>, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page || '1') || 1;
    const limit = parseInt(req.query.limit || '20') || 20;
    
    const fileList = await fileStorage.getFileList(page, limit) as FileListResult;
    
    res.json({
      success: true,
      data: fileList
    });
  } catch (error) {
    console.error('[Files] Get file list failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export = router;