/**
 * 图片上传路由
 * 基于本地文件存储，不依赖外部服务
 */

const express = require('express');
const imageUpload = require('../image-upload');
const messageStore = require('../message-store');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// 创建上传中间件
const upload = imageUpload.createUploadMiddleware();

/**
 * 上传图片
 * POST /api/images/upload
 */
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: '请选择要上传的图片' 
      });
    }

    const uploadedBy = req.body.uploadedBy || 'anonymous';
    const messageId = req.body.messageId || null;

    // 处理上传的文件
    const imageData = await imageUpload.processUploadedFile(
      req.file, 
      uploadedBy, 
      messageId
    );

    // 如果关联了消息，保存图片信息到数据库
    if (messageId) {
      try {
        await messageStore.addImageToMessage(messageId, imageData);
      } catch (e) {
        console.warn('[Images] 保存图片信息到消息失败:', e.message);
      }
    }

    res.json({
      success: true,
      data: {
        id: imageData.id,
        filename: imageData.filename,
        originalName: imageData.originalName,
        url: `/api/images/${imageData.filename}`,
        thumbnailUrl: imageData.thumbnailPath ? `/api/images/thumbnail/${imageData.filename}` : null,
        mimeType: imageData.mimeType,
        fileSize: imageData.fileSize,
        formattedSize: imageUpload.formatFileSize(imageData.fileSize),
        width: imageData.width,
        height: imageData.height
      }
    });
  } catch (error) {
    console.error('[Images] 上传失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 获取图片
 * GET /api/images/:filename
 */
router.get('/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const imagePath = path.join(imageUpload.imageDir, filename);

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ 
        success: false, 
        error: '图片不存在' 
      });
    }

    // 设置缓存头
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(imagePath);
  } catch (error) {
    console.error('[Images] 获取图片失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 获取缩略图
 * GET /api/images/thumbnail/:filename
 */
router.get('/thumbnail/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const thumbnailFilename = `thumb_${filename}`;
    const thumbnailPath = path.join(imageUpload.thumbnailDir, thumbnailFilename);

    if (!fs.existsSync(thumbnailPath)) {
      // 如果缩略图不存在，返回原图
      const imagePath = path.join(imageUpload.imageDir, filename);
      if (fs.existsSync(imagePath)) {
        return res.sendFile(imagePath);
      }
      return res.status(404).json({ 
        success: false, 
        error: '图片不存在' 
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(thumbnailPath);
  } catch (error) {
    console.error('[Images] 获取缩略图失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 删除图片
 * DELETE /api/images/:filename
 */
router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const imagePath = path.join(imageUpload.imageDir, filename);
    const thumbnailPath = path.join(imageUpload.thumbnailDir, `thumb_${filename}`);

    const deleted = imageUpload.deleteImageFiles(imagePath, thumbnailPath);

    if (deleted) {
      res.json({ 
        success: true, 
        message: '图片已删除' 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: '图片不存在或删除失败' 
      });
    }
  } catch (error) {
    console.error('[Images] 删除图片失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
