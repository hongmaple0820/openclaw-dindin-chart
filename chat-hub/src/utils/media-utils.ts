/**
 * 媒体处理工具
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface MediaDimensions {
  width: number | null;
  height: number | null;
}

interface MediaInfo {
  fileId: string;
  originalName: string;
  filePath: string;
  mimeType: string;
  mediaType: 'image' | 'video' | 'audio' | 'file';
  fileSize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  thumbnailPath: string | null;
}

interface ValidateResult {
  mimeType: string;
  mediaType: 'image' | 'video' | 'audio' | 'file';
}

class MediaUtils {
  private uploadDir: string;
  private mediaDir: string;
  private thumbnailDir: string;

  constructor(uploadDir: string = './uploads') {
    this.uploadDir = uploadDir;
    this.mediaDir = path.join(uploadDir, 'media');
    this.thumbnailDir = path.join(uploadDir, 'thumbnails');
    this.initDirectories();
  }

  /**
   * 初始化目录结构
   */
  private initDirectories(): void {
    [this.mediaDir, this.thumbnailDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * 生成唯一文件ID
   */
  generateFileId(originalName: string): string {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(8).toString('hex');
    return `${name}_${timestamp}_${randomStr}${ext}`;
  }

  /**
   * 获取文件MIME类型
   */
  getMimeType(buffer: Buffer, filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.flv': 'video/x-flv',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
      '.m4a': 'audio/mp4'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * 检测媒体类型
   */
  detectMediaType(mimeType: string): 'image' | 'video' | 'audio' | 'file' {
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    } else if (mimeType.startsWith('audio/')) {
      return 'audio';
    } else {
      return 'file';
    }
  }

  /**
   * 获取图像尺寸
   */
  async getImageDimensions(filePath: string): Promise<MediaDimensions> {
    try {
      // 尝试使用sharp库（如果已安装）
      const sharp = require('sharp');
      const metadata = await sharp(filePath).metadata();
      return {
        width: metadata.width || null,
        height: metadata.height || null
      };
    } catch (error) {
      const err = error as Error;
      // 如果sharp不可用，尝试其他方法
      console.warn('Sharp not available, skipping dimension detection:', err.message);
      return { width: null, height: null };
    }
  }

  /**
   * 获取视频/音频时长
   */
  async getMediaDuration(filePath: string): Promise<number | null> {
    try {
      const { stdout } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`);
      const duration = parseFloat(stdout.trim());
      return isNaN(duration) ? null : duration;
    } catch (error) {
      const err = error as Error;
      console.warn('FFmpeg not available or error getting duration:', err.message);
      return null;
    }
  }

  /**
   * 创建图像缩略图
   */
  async createThumbnail(filePath: string, outputFile: string, maxWidth: number = 200, maxHeight: number = 200): Promise<string | null> {
    try {
      const sharp = require('sharp');
      await sharp(filePath)
        .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(outputFile);
      
      return outputFile;
    } catch (error) {
      const err = error as Error;
      console.warn('Error creating thumbnail:', err.message);
      return null;
    }
  }

  /**
   * 验证文件类型
   */
  validateFileType(buffer: Buffer, filename: string, allowedTypes: string[] = []): ValidateResult {
    const mimeType = this.getMimeType(buffer, filename);
    const mediaType = this.detectMediaType(mimeType);
    
    // 默认允许的媒体类型
    const defaultAllowedTypes = ['image', 'video', 'audio'];
    const allowedMediaTypes = allowedTypes.length > 0 ? allowedTypes : defaultAllowedTypes;
    
    if (!allowedMediaTypes.includes(mediaType)) {
      throw new Error(`File type not allowed: ${mediaType}`);
    }
    
    // 额外的安全检查：验证文件头
    const isValid = this.validateFileSignature(buffer, mimeType);
    if (!isValid) {
      throw new Error('Invalid file signature');
    }
    
    return { mimeType, mediaType };
  }

  /**
   * 验证文件签名（基本安全检查）
   */
  validateFileSignature(buffer: Buffer, mimeType: string): boolean {
    if (!buffer || buffer.length < 10) {
      return false;
    }
    
    // 图像文件头检查
    if (mimeType.startsWith('image/')) {
      if (mimeType === 'image/jpeg') {
        return buffer[0] === 0xFF && buffer[1] === 0xD8;
      } else if (mimeType === 'image/png') {
        return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
      } else if (mimeType === 'image/gif') {
        return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
      } else if (mimeType === 'image/bmp') {
        return buffer[0] === 0x42 && buffer[1] === 0x4D;
      } else if (mimeType === 'image/webp') {
        return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
      }
    }
    
    // 对于其他类型，我们只进行基本检查
    return true;
  }

  /**
   * 保存媒体文件
   */
  async saveMediaFile(fileBuffer: Buffer, originalName: string): Promise<MediaInfo> {
    try {
      const fileId = this.generateFileId(originalName);
      const filePath = path.join(this.mediaDir, fileId);
      
      // 写入文件
      await fs.promises.writeFile(filePath, fileBuffer);
      
      // 获取文件信息
      const mimeType = this.getMimeType(fileBuffer, originalName);
      const mediaType = this.detectMediaType(mimeType);
      const stats = await fs.promises.stat(filePath);
      const fileSize = stats.size;
      
      // 获取额外信息
      let additionalInfo: {
        width?: number | null;
        height?: number | null;
        duration?: number | null;
        thumbnailPath?: string | null;
      } = {};
      
      if (mediaType === 'image') {
        additionalInfo = await this.getImageDimensions(filePath);
        
        // 创建缩略图
        const thumbnailPath = path.join(this.thumbnailDir, `${path.parse(fileId).name}_thumb.jpg`);
        const thumbResult = await this.createThumbnail(filePath, thumbnailPath);
        additionalInfo.thumbnailPath = thumbResult;
      } else if (mediaType === 'video' || mediaType === 'audio') {
        additionalInfo.duration = await this.getMediaDuration(filePath);
      }
      
      return {
        fileId,
        originalName,
        filePath,
        mimeType,
        mediaType,
        fileSize,
        width: additionalInfo.width || null,
        height: additionalInfo.height || null,
        duration: additionalInfo.duration || null,
        thumbnailPath: additionalInfo.thumbnailPath || null
      };
    } catch (error) {
      console.error('Error saving media file:', error);
      throw error;
    }
  }

  /**
   * 获取媒体文件URL
   */
  getMediaUrl(fileId: string): string {
    return `/api/files/media/${fileId}`;
  }

  /**
   * 获取缩略图URL
   */
  getThumbnailUrl(fileId: string): string {
    return `/api/files/thumbnail/${fileId}`;
  }
}

export = MediaUtils;