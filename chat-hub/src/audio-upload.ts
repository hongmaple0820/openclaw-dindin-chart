/**
 * 语音上传服务
 * 支持多种音频格式：MP3, AMR, AAC, WAV, OGG, WebM
 * 
 * @author 小琳
 * @date 2026-03-06
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

/**
 * 音频上传服务类
 */
class AudioUploadService {
  uploadDir: string;
  audioDir: string;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  maxFileSize: number;

  constructor() {
    // 从配置文件获取存储路径
    const storagePath = config.storage?.path || '~/.openclaw/chat-data/messages.db';
    const storageDir = path.dirname(storagePath.replace('~', process.env.HOME));
    
    // 上传目录
    this.uploadDir = path.join(storageDir, 'uploads');
    this.audioDir = path.join(this.uploadDir, 'audio');
    
    // 创建目录
    [this.uploadDir, this.audioDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('[AudioUpload] 创建目录:', dir);
      }
    });

    console.log('[AudioUpload] 存储目录:', this.audioDir);

    // 支持的音频类型
    this.allowedMimeTypes = [
      'audio/mpeg',           // MP3
      'audio/mp3',
      'audio/amr',            // AMR (钉钉格式)
      'audio/aac',            // AAC
      'audio/x-aac',
      'audio/mp4',            // M4A/AAC in MP4
      'audio/wav',            // WAV
      'audio/x-wav',
      'audio/ogg',            // OGG
      'audio/webm',           // WebM audio
      'audio/webm;codecs=opus',
      'audio/3gpp',           // 3GP (钉钉语音)
      'audio/3gpp2'
    ];

    // 支持的扩展名
    this.allowedExtensions = ['.mp3', '.amr', '.aac', '.m4a', '.wav', '.ogg', '.webm', '.3gp'];

    // 文件大小限制（默认 50MB，语音文件通常较小）
    this.maxFileSize = 50 * 1024 * 1024;

    // 音频转换配置
    this.conversionConfig = {
      // AMR 转换为 MP3 的参数（钉钉语音需要）
      amrToMp3: {
        bitrate: '32k',
        sampleRate: 8000,
        channels: 1
      }
    };
  }

  /**
   * 配置 multer 存储
   */
  getMulterStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.audioDir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || this.getExtensionFromMime(file.mimetype);
        const filename = `${uuidv4()}${ext}`;
        cb(null, filename);
      }
    });
  }

  /**
   * 从 MIME 类型获取扩展名
   */
  getExtensionFromMime(mimetype) {
    const mimeMap = {
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'audio/amr': '.amr',
      'audio/aac': '.aac',
      'audio/x-aac': '.aac',
      'audio/mp4': '.m4a',
      'audio/wav': '.wav',
      'audio/x-wav': '.wav',
      'audio/ogg': '.ogg',
      'audio/webm': '.webm',
      'audio/3gpp': '.3gp',
      'audio/3gpp2': '.3gp'
    };
    return mimeMap[mimetype] || '.mp3';
  }

  /**
   * 配置 multer 文件过滤
   */
  fileFilter(req, file, cb) {
    // 检查 MIME 类型
    const isValidMime = this.allowedMimeTypes.some(type => 
      file.mimetype.includes(type.split(';')[0])
    );
    
    // 检查扩展名
    const ext = path.extname(file.originalname).toLowerCase();
    const isValidExt = this.allowedExtensions.includes(ext);
    
    if (isValidMime || isValidExt) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的音频格式: ${file.mimetype} (${ext})`), false);
    }
  }

  /**
   * 创建 multer 上传中间件
   */
  createUploadMiddleware() {
    return multer({
      storage: this.getMulterStorage(),
      fileFilter: this.fileFilter.bind(this),
      limits: {
        fileSize: this.maxFileSize
      }
    });
  }

  /**
   * 获取音频时长
   * 使用 Node.js 原生方式解析音频头部信息
   * @param {string} filePath 音频文件路径
   * @param {string} mimeType MIME 类型
   */
  async getAudioDuration(filePath, mimeType) {
    try {
      // 对于简单格式，我们可以通过文件大小估算
      // 但最准确的方式是使用 ffmpeg
      
      // 检查是否有 ffmpeg
      const { execSync } = require('child_process');
      try {
        const duration = execSync(
          `ffprobe -i "${filePath}" -show_entries format=duration -v quiet -of csv="p=0"`,
          { encoding: 'utf-8', timeout: 5000 }
        ).trim();
        return parseFloat(duration);
      } catch (ffError: any) {
        // ffmpeg 不可用，使用备用方法
        console.warn('[AudioUpload] ffmpeg 不可用，使用估算时长');
        return this.estimateDuration(filePath, mimeType);
      }
    } catch (error: any) {
      console.error('[AudioUpload] 获取音频时长失败:', error.message);
      return null;
    }
  }

  /**
   * 估算音频时长（备用方法）
   */
  estimateDuration(filePath, mimeType) {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    // 不同格式的比特率估算
    const bitrateMap = {
      'audio/amr': 12200,      // AMR 约 12.2 kbps
      'audio/aac': 96000,      // AAC 约 96 kbps
      'audio/mpeg': 128000,    // MP3 约 128 kbps
      'audio/mp3': 128000,
      'audio/wav': 256000,     // WAV 取决于采样率
      'audio/ogg': 112000,
      'audio/webm': 64000
    };
    
    const bitrate = bitrateMap[mimeType] || 64000;
    const duration = (fileSize * 8) / bitrate;
    
    // 限制最大时长为 5 分钟
    return Math.min(duration, 300);
  }

  /**
   * 处理上传的音频文件
   * @param {Object} file multer file 对象
   * @param {string} uploadedBy 上传者
   * @param {string} messageId 关联的消息ID
   */
  async processUploadedFile(file, uploadedBy, messageId) {
    try {
      // 获取音频时长
      const duration = await this.getAudioDuration(file.path, file.mimetype);

      const audioData = {
        id: uuidv4(),
        messageId,
        filename: file.filename,
        originalName: file.originalname || 'voice-message',
        filePath: file.path,
        mimeType: file.mimetype,
        fileSize: file.size,
        duration: duration ? Math.round(duration * 10) / 10 : null, // 保留一位小数
        uploadedBy
      };

      console.log('[AudioUpload] 音频处理完成:', {
        filename: file.filename,
        size: file.size,
        duration: audioData.duration
      });

      return audioData;
    } catch (error: any) {
      console.error('[AudioUpload] 处理文件失败:', error.message);
      throw error;
    }
  }

  /**
   * AMR 转 MP3（钉钉语音消息转换）
   * 需要安装 ffmpeg
   * @param {string} amrPath AMR 文件路径
   * @returns {string} MP3 文件路径
   */
  async convertAmrToMp3(amrPath) {
    try {
      const { execSync } = require('child_process');
      const mp3Path = amrPath.replace('.amr', '.mp3');
      
      execSync(
        `ffmpeg -i "${amrPath}" -ar 8000 -ac 1 -ab 32k "${mp3Path}" -y`,
        { timeout: 30000 }
      );
      
      console.log('[AudioUpload] AMR 转 MP3 成功:', mp3Path);
      return mp3Path;
    } catch (error: any) {
      console.error('[AudioUpload] AMR 转 MP3 失败:', error.message);
      // 转换失败，返回原文件
      return amrPath;
    }
  }

  /**
   * 删除音频文件
   */
  deleteAudioFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('[AudioUpload] 删除音频:', filePath);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('[AudioUpload] 删除文件失败:', error.message);
      return false;
    }
  }

  /**
   * 验证文件类型
   */
  isValidAudioType(mimeType) {
    return this.allowedMimeTypes.some(type => 
      mimeType.includes(type.split(';')[0])
    );
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /**
   * 格式化时长
   */
  formatDuration(seconds) {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

module.exports = new AudioUploadService();
export {};
