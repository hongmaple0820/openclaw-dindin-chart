/**
 * 媒体API接口
 */

import express, { Request, Response, Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import MediaUtils from './media-utils';
import MessageModelExtension from './message-model-extension';

interface MediaInfoResult {
  fileId: string;
  mimeType: string;
  mediaType: string;
  size: number;
  thumbnailPath?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
}

interface UploadResultData {
  fileId: string;
  originalName: string;
  mediaType: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  url: string;
  thumbnailUrl: string | null;
}

// Define Multer file type locally to avoid relying on ambient Express namespace augmentation.
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
  stream?: NodeJS.ReadableStream;
}

type MulterRequest = Request & {
  file?: MulterFile;
};

class MediaAPI {
  private dbPath: string;
  private uploadDir: string;
  private mediaUtils: MediaUtils;
  private messageModel: MessageModelExtension;
  private router: Router;
  private storage: multer.StorageEngine;
  private upload: multer.Multer;

  constructor(dbPath: string, uploadDir: string = './uploads') {
    this.dbPath = dbPath;
    this.uploadDir = uploadDir;
    this.mediaUtils = new MediaUtils(uploadDir);
    this.messageModel = new MessageModelExtension(dbPath);
    this.router = express.Router();
    this.storage = this.initStorage();
    this.upload = multer({ 
      storage: this.storage,
      limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
      },
      fileFilter: this.fileFilter.bind(this)
    });
    this.initRoutes();
  }

  /**
   * 初始化multer存储
   */
  private initStorage(): multer.StorageEngine {
    // 设置存储引擎
    return multer.diskStorage({
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
  }

  /**
   * 文件过滤器
   */
  private fileFilter(req: Request, file: MulterFile, cb: (error: Error | null, acceptFile: boolean) => void): void {
    // 允许的文件类型
    const allowedTypes: string[] = [
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

  /**
   * 初始化路由
   */
  private initRoutes(): void {
    // 上传媒体文件
    this.router.post('/upload', this.upload.single('media'), async (req: Request, res: Response): Promise<void> => {
      try {
        const multerReq = req as MulterRequest;
        const file = multerReq.file;
        if (!file) {
          res.status(400).json({
            success: false,
            error: 'No file provided'
          });
          return;
        }

        // 验证文件类型
        const fileInfo = this.mediaUtils.validateFileType(
          fs.readFileSync(file.path),
          file.originalname
        );

        // 保存媒体文件
        const mediaInfo = await this.mediaUtils.saveMediaFile(
          fs.readFileSync(file.path),
          file.originalname
        );

        // 清理临时文件
        fs.unlinkSync(file.path);

        const responseData: UploadResultData = {
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
        };

        res.json({
          success: true,
          data: responseData
        });
      } catch (error) {
        const err = error as Error;
        console.error('Media upload error:', err);
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // 获取媒体文件
    this.router.get('/media/:fileId', async (req: Request, res: Response): Promise<void> => {
      try {
        const fileId = req.params.fileId as string;
        const filePath = path.join(this.mediaUtils['mediaDir'], fileId);

        if (!fs.existsSync(filePath)) {
          res.status(404).json({
            success: false,
            error: 'File not found'
          });
          return;
        }

        res.sendFile(filePath);
      } catch (error) {
        const err = error as Error;
        console.error('Get media error:', err);
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // 获取缩略图
    this.router.get('/thumbnail/:fileId', async (req: Request, res: Response): Promise<void> => {
      try {
        const fileId = req.params.fileId as string;
        const thumbnailPath = path.join(this.mediaUtils['thumbnailDir'], 
          `${path.parse(fileId).name}_thumb.jpg`);

        if (!fs.existsSync(thumbnailPath)) {
          res.status(404).json({
            success: false,
            error: 'Thumbnail not found'
          });
          return;
        }

        res.sendFile(thumbnailPath);
      } catch (error) {
        const err = error as Error;
        console.error('Get thumbnail error:', err);
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // 发送带媒体的消息
    this.router.post('/message-with-media', async (req: Request, res: Response): Promise<void> => {
      try {
        const body = req.body as { content?: string; sender?: string; mediaFileId?: string };
        const { content, sender, mediaFileId } = body;

        if (!content || !sender || !mediaFileId) {
          res.status(400).json({
            success: false,
            error: 'content, sender, and mediaFileId are required'
          });
          return;
        }

        // 获取媒体文件信息
        const mediaInfoPath = path.join(this.mediaUtils['mediaDir'], mediaFileId);
        if (!fs.existsSync(mediaInfoPath)) {
          res.status(404).json({
            success: false,
            error: 'Media file not found'
          });
          return;
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
        const err = error as Error;
        console.error('Send message with media error:', err);
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // 获取带媒体的消息
    this.router.get('/messages-with-media', async (req: Request, res: Response): Promise<void> => {
      try {
        const limitParam = req.query.limit;
        const limitStr = Array.isArray(limitParam) ? limitParam[0] as string : limitParam as string;
        const limit = parseInt(limitStr || '50') || 50;
        const messages = await this.messageModel.getRecentMessagesWithMedia(limit);

        res.json({
          success: true,
          data: {
            messages,
            count: messages.length
          }
        });
      } catch (error) {
        const err = error as Error;
        console.error('Get messages with media error:', err);
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });
  }

  /**
   * 获取媒体文件信息
   */
  private async getMediaInfo(fileId: string): Promise<MediaInfoResult> {
    const filePath = path.join(this.mediaUtils['mediaDir'], fileId);
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
  getRouter(): Router {
    return this.router;
  }
}

export = MediaAPI;
