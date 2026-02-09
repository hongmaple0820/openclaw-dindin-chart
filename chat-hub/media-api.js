/**
 * 媒体API接口
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const MediaUtils = require('./media-utils');
const MessageModelExtension = require('./message-model-extension');

class MediaAPI {
  constructor(dbPath, uploadDir = './uploads') {
    this.dbPath = dbPath;
    this.uploadDir = uploadDir;
    this.mediaUtils = new MediaUtils(uploadDir);
    this.messageModel = new MessageModelExtension(dbPath);
    this.router = express.Router();
    this.initStorage();
    this.initRoutes();
  }

  /**
   * 初始化multer存储
   */
  initStorage() {
    // 设置存储引擎
    this.storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const mediaDir = path.join(this.uploadDir, 'temp');
        if (!fs.existsSync(mediaDir)) {
          fs.mkdirSync(mediaDir, { recursive: true });
        }
        cb(null, mediaDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    });
    
    this.upload = multer({ 
      storage: this.storage,
      limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
      },
      fileFilter: (req, file, cb) => {
        // 允许的文件类型
        const allowedTypes = [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
          'video/mp4', 'video/webm', 'video/ogg',
          'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('File type not allowed'), false);
        }
      }
    });
  }

  /**
   * 初始化路由
   */
  initRoutes() {
    // 上传媒体文件
    this.router.post('/upload', this.upload.single('media'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'No file provided'
          });
        }

        // 验证文件类型
        const fileInfo = this.mediaUtils.validateFileType(
          fs.readFileSync(req.file.path),
          req.file.originalname
        );

        // 保存媒体文件
        const mediaInfo = await this.mediaUtils.saveMediaFile(
          fs.readFileSync(req.file.path),
          req.file.originalname
        );

        // 清理临时文件
        fs.unlinkSync(req.file.path);

        res.json({
          success: true,
          data: {
            fileId: mediaInfo.fileId,
            originalName: mediaInfo.originalName,
            mediaType: mediaInfo.mediaType,
            mimeType: mediaInfo.mimeType,
            fileSize: mediaInfo.fileSize,
            width: mediaInfo.width,
            height: mediaInfo.height,
            duration: mediaInfo.duration,
            url: this.mediaUtils.getMediaUrl(mediaInfo.fileId),
            thumbnailUrl: mediaInfo.thumbnailPath ? 
              this.mediaUtils.getThumbnailUrl(mediaInfo.fileId) : null
          }
        });
      } catch (error) {
        console.error('Media upload error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取媒体文件
    this.router.get('/media/:fileId', async (req, res) => {
      try {
        const { fileId } = req.params;
        const filePath = path.join(this.mediaUtils.mediaDir, fileId);

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({
            success: false,
            error: 'File not found'
          });
        }

        res.sendFile(filePath);
      } catch (error) {
        console.error('Get media error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取缩略图
    this.router.get('/thumbnail/:fileId', async (req, res) => {
      try {
        const { fileId } = req.params;
        const thumbnailPath = path.join(this.mediaUtils.thumbnailDir, 
          `${path.parse(fileId).name}_thumb.jpg`);

        if (!fs.existsSync(thumbnailPath)) {
          return res.status(404).json({
            success: false,
            error: 'Thumbnail not found'
          });
        }

        res.sendFile(thumbnailPath);
      } catch (error) {
        console.error('Get thumbnail error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 发送带媒体的消息
    this.router.post('/message-with-media', async (req, res) => {
      try {
        const { content, sender, mediaFileId } = req.body;

        if (!content || !sender || !mediaFileId) {
          return res.status(400).json({
            success: false,
            error: 'content, sender, and mediaFileId are required'
          });
        }

        // 获取媒体文件信息
        const mediaInfoPath = path.join(this.mediaUtils.mediaDir, mediaFileId);
        if (!fs.existsSync(mediaInfoPath)) {
          return res.status(404).json({
            success: false,
            error: 'Media file not found'
          });
        }

        const stats = await fs.promises.stat(mediaInfoPath);
        const mediaInfo = await this.getMediaInfo(mediaFileId);

        // 创建消息对象
        const messageData = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'human',
          sender,
          content,
          timestamp: Date.now(),
          source: 'web',
          media_type: mediaInfo.mediaType,
          media_url: this.mediaUtils.getMediaUrl(mediaInfo.fileId),
          media_thumbnail_url: mediaInfo.thumbnailPath ? 
            this.mediaUtils.getThumbnailUrl(mediaInfo.fileId) : null,
          media_size: stats.size,
          duration: mediaInfo.duration,
          width: mediaInfo.width,
          height: mediaInfo.height
        };

        // 插入带媒体的消息
        await this.messageModel.insertMessageWithMedia(messageData);

        res.json({
          success: true,
          data: messageData
        });
      } catch (error) {
        console.error('Send message with media error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取带媒体的消息
    this.router.get('/messages-with-media', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const messages = await this.messageModel.getRecentMessagesWithMedia(limit);

        res.json({
          success: true,
          data: {
            messages,
            count: messages.length
          }
        });
      } catch (error) {
        console.error('Get messages with media error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }

  /**
   * 获取媒体文件信息
   */
  async getMediaInfo(fileId) {
    const filePath = path.join(this.mediaUtils.mediaDir, fileId);
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }

    const stats = await fs.promises.stat(filePath);
    const buffer = await fs.promises.readFile(filePath.slice(0, 100)); // Read first 100 bytes for signature check
    
    const mimeType = this.mediaUtils.getMimeType(buffer, fileId);
    const mediaType = this.mediaUtils.detectMediaType(mimeType);

    return {
      fileId,
      mimeType,
      mediaType,
      size: stats.size
    };
  }

  /**
   * 获取路由器
   */
  getRouter() {
    return this.router;
  }
}

module.exports = MediaAPI;

// For testing purposes
if (require.main === module) {
  console.log('MediaAPI module loaded successfully');
}