/**
 * 文件上传/下载路由
 */

const express = require('express');
const FileStorage = require('../api/file-storage');
const router = express.Router();

// 初始化文件存储
const fileStorage = new FileStorage();

// 初始化分片上传
router.post('/upload/init', async (req, res) => {
  try {
    const { name, size, type } = req.body;
    
    if (!name || !size) {
      return res.status(400).json({ error: 'Missing required fields: name, size' });
    }
    
    const uploadInfo = await fileStorage.initUpload({
      name,
      size,
      type
    });
    
    res.json({
      success: true,
      data: uploadInfo
    });
  } catch (error) {
    console.error('[Files] Init upload failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// 上传分片
router.put('/upload/:id/chunk/:index', async (req, res) => {
  try {
    const { id: uploadId } = req.params;
    const { index } = req.params;
    const chunkIndex = parseInt(index);
    
    if (isNaN(chunkIndex) || chunkIndex < 0) {
      return res.status(400).json({ error: 'Invalid chunk index' });
    }
    
    const chunkData = req.body;
    const chunkHash = req.headers['x-chunk-hash']; // 可选的分片哈希校验
    
    const result = await fileStorage.uploadChunk(uploadId, chunkIndex, chunkData, chunkHash);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Files] Upload chunk failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// 查询上传进度
router.get('/upload/:id/progress', async (req, res) => {
  try {
    const { id: uploadId } = req.params;
    
    const progress = await fileStorage.getProgress(uploadId);
    
    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('[Files] Get progress failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// 完成分片上传
router.post('/upload/:id/complete', async (req, res) => {
  try {
    const { id: uploadId } = req.params;
    
    const result = await fileStorage.completeUpload(uploadId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Files] Complete upload failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// 下载文件
router.get('/:id/download', async (req, res) => {
  try {
    const { id: fileId } = req.params;
    const range = req.headers.range;
    
    const downloadInfo = await fileStorage.downloadFile(fileId, range);
    
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
    res.status(500).json({ error: error.message });
  }
});

// 获取文件列表
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const fileList = await fileStorage.getFileList(page, limit);
    
    res.json({
      success: true,
      data: fileList
    });
  } catch (error) {
    console.error('[Files] Get file list failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;