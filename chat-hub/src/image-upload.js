const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * 图片上传服务
 */
class ImageUploadService {
  constructor() {
    // 上传目录
    this.uploadDir = path.join(process.env.HOME, '.openclaw', 'chat-data', 'uploads');
    this.imageDir = path.join(this.uploadDir, 'images');
    this.thumbnailDir = path.join(this.uploadDir, 'thumbnails');
    
    // 创建目录
    [this.uploadDir, this.imageDir, this.thumbnailDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('[ImageUpload] 创建目录:', dir);
      }
    });

    // 支持的图片类型
    this.allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];

    // 文件大小限制（10MB）
    this.maxFileSize = 10 * 1024 * 1024;

    // 缩略图尺寸
    this.thumbnailSize = { width: 200, height: 200 };
  }

  /**
   * 配置 multer 存储
   */
  getMulterStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.imageDir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${uuidv4()}${ext}`;
        cb(null, filename);
      }
    });
  }

  /**
   * 配置 multer 文件过滤
   */
  fileFilter(req, file, cb) {
    if (this.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
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
   * 生成缩略图
   * @param {string} imagePath 原图路径
   * @param {string} filename 文件名
   */
  async generateThumbnail(imagePath, filename) {
    try {
      const thumbnailPath = path.join(this.thumbnailDir, filename);
      
      await sharp(imagePath)
        .resize(this.thumbnailSize.width, this.thumbnailSize.height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      console.log('[ImageUpload] 缩略图已生成:', thumbnailPath);
      return thumbnailPath;
    } catch (error) {
      console.error('[ImageUpload] 生成缩略图失败:', error.message);
      return null;
    }
  }

  /**
   * 获取图片尺寸
   * @param {string} imagePath 图片路径
   */
  async getImageDimensions(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      return {
        width: metadata.width,
        height: metadata.height
      };
    } catch (error) {
      console.error('[ImageUpload] 获取图片尺寸失败:', error.message);
      return null;
    }
  }

  /**
   * 处理上传的文件
   * @param {Object} file multer file 对象
   * @param {string} uploadedBy 上传者
   * @param {string} messageId 关联的消息ID
   */
  async processUploadedFile(file, uploadedBy, messageId) {
    try {
      // 获取图片尺寸
      const dimensions = await this.getImageDimensions(file.path);

      // 生成缩略图
      const thumbnailPath = await this.generateThumbnail(file.path, `thumb_${file.filename}`);

      const imageData = {
        id: uuidv4(),
        messageId,
        filename: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        thumbnailPath,
        mimeType: file.mimetype,
        fileSize: file.size,
        width: dimensions?.width,
        height: dimensions?.height,
        uploadedBy
      };

      return imageData;
    } catch (error) {
      console.error('[ImageUpload] 处理文件失败:', error.message);
      throw error;
    }
  }

  /**
   * 删除图片文件
   * @param {string} imagePath 图片路径
   * @param {string} thumbnailPath 缩略图路径
   */
  deleteImageFiles(imagePath, thumbnailPath) {
    try {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log('[ImageUpload] 删除图片:', imagePath);
      }
      
      if (thumbnailPath && fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
        console.log('[ImageUpload] 删除缩略图:', thumbnailPath);
      }
      
      return true;
    } catch (error) {
      console.error('[ImageUpload] 删除文件失败:', error.message);
      return false;
    }
  }

  /**
   * 验证文件类型
   * @param {string} mimeType MIME 类型
   */
  isValidImageType(mimeType) {
    return this.allowedMimeTypes.includes(mimeType);
  }

  /**
   * 格式化文件大小
   * @param {number} bytes 字节数
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}

module.exports = new ImageUploadService();
