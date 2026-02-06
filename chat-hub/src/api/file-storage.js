/**
 * 文件存储 API
 * 支持分片上传、断点续传、大文件处理
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

class FileStorage {
  constructor(options = {}) {
    this.uploadDir = options.uploadDir || path.join(process.cwd(), 'uploads');
    this.tempDir = path.join(this.uploadDir, 'temp');
    this.chunkSize = options.chunkSize || 1024 * 1024 * 5; // 5MB per chunk
    this.maxFileSize = options.maxFileSize || 1024 * 1024 * 1024; // 1GB
    this.cleanupInterval = options.cleanupInterval || 30 * 60 * 1000; // 30分钟清理临时文件
    
    this.init();
  }

  async init() {
    // 创建必要的目录
    await fs.mkdir(this.uploadDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
    
    // 启动清理定时器
    setInterval(() => this.cleanupTempFiles(), this.cleanupInterval);
  }

  /**
   * 初始化分片上传
   */
  async initUpload(fileInfo) {
    const fileId = uuidv4();
    const uploadId = uuidv4();
    const totalChunks = Math.ceil(fileInfo.size / this.chunkSize);
    
    const uploadInfo = {
      id: uploadId,
      fileId: fileId,
      fileName: fileInfo.name,
      fileSize: fileInfo.size,
      mimeType: fileInfo.type,
      totalChunks: totalChunks,
      uploadedChunks: [],
      status: 'initiated',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时后过期
    };
    
    // 创建上传目录
    const uploadPath = path.join(this.tempDir, uploadId);
    await fs.mkdir(uploadPath, { recursive: true });
    
    // 保存上传信息
    await fs.writeFile(
      path.join(uploadPath, 'info.json'),
      JSON.stringify(uploadInfo)
    );
    
    return uploadInfo;
  }

  /**
   * 上传分片
   */
  async uploadChunk(uploadId, chunkIndex, chunkData, chunkHash) {
    const uploadPath = path.join(this.tempDir, uploadId);
    const infoPath = path.join(uploadPath, 'info.json');
    
    if (!await this.exists(infoPath)) {
      throw new Error('Upload session not found');
    }
    
    const info = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
    
    // 验证分片序号
    if (chunkIndex >= info.totalChunks) {
      throw new Error('Invalid chunk index');
    }
    
    // 验证分片大小
    if (chunkData.length > this.chunkSize) {
      throw new Error('Chunk size exceeds limit');
    }
    
    // 验证分片哈希（可选）
    if (chunkHash) {
      const calculatedHash = crypto.createHash('md5').update(chunkData).digest('hex');
      if (calculatedHash !== chunkHash) {
        throw new Error('Chunk hash mismatch');
      }
    }
    
    // 保存分片
    const chunkPath = path.join(uploadPath, `chunk_${chunkIndex}`);
    await fs.writeFile(chunkPath, chunkData);
    
    // 更新上传信息
    info.uploadedChunks.push(chunkIndex);
    info.status = 'uploading';
    await fs.writeFile(infoPath, JSON.stringify(info));
    
    return {
      uploadId,
      chunkIndex,
      completed: info.uploadedChunks.length === info.totalChunks
    };
  }

  /**
   * 完成分片上传
   */
  async completeUpload(uploadId) {
    const uploadPath = path.join(this.tempDir, uploadId);
    const infoPath = path.join(uploadPath, 'info.json');
    
    if (!await this.exists(infoPath)) {
      throw new Error('Upload session not found');
    }
    
    const info = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
    
    // 检查是否所有分片都已上传
    if (info.uploadedChunks.length !== info.totalChunks) {
      throw new Error('Not all chunks uploaded');
    }
    
    // 按序号排序分片
    const sortedChunks = info.uploadedChunks.sort((a, b) => a - b);
    
    // 合并分片
    const finalPath = path.join(this.uploadDir, info.fileId);
    const finalStream = fs.createWriteStream(finalPath);
    
    for (const chunkIndex of sortedChunks) {
      const chunkPath = path.join(uploadPath, `chunk_${chunkIndex}`);
      const chunkBuffer = await fs.readFile(chunkPath);
      await new Promise(resolve => {
        finalStream.write(chunkBuffer, resolve);
      });
    }
    
    finalStream.end();
    await new Promise(resolve => finalStream.on('finish', resolve));
    
    // 计算最终文件哈希
    const fileBuffer = await fs.readFile(finalPath);
    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    
    // 更新信息
    info.status = 'completed';
    info.completedAt = new Date().toISOString();
    info.fileHash = fileHash;
    info.filePath = finalPath;
    await fs.writeFile(infoPath, JSON.stringify(info));
    
    // 删除临时文件
    await fs.rm(uploadPath, { recursive: true, force: true });
    
    return {
      fileId: info.fileId,
      fileName: info.fileName,
      fileSize: info.fileSize,
      mimeType: info.mimeType,
      fileHash: fileHash,
      downloadUrl: `/api/files/${info.fileId}/download`
    };
  }

  /**
   * 获取上传进度
   */
  async getProgress(uploadId) {
    const uploadPath = path.join(this.tempDir, uploadId);
    const infoPath = path.join(uploadPath, 'info.json');
    
    if (!await this.exists(infoPath)) {
      throw new Error('Upload session not found');
    }
    
    const info = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
    
    return {
      uploadId,
      status: info.status,
      uploadedChunks: info.uploadedChunks.length,
      totalChunks: info.totalChunks,
      progress: Math.round((info.uploadedChunks.length / info.totalChunks) * 100),
      uploadedBytes: info.uploadedChunks.length * this.chunkSize,
      totalBytes: info.fileSize
    };
  }

  /**
   * 下载文件
   */
  async downloadFile(fileId, range = null) {
    const filePath = path.join(this.uploadDir, fileId);
    
    if (!await this.exists(filePath)) {
      throw new Error('File not found');
    }
    
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;
    
    if (!range) {
      // 全部下载
      return {
        stream: await fs.readFile(filePath),
        size: fileSize,
        headers: {
          'Content-Length': fileSize,
          'Content-Type': 'application/octet-stream'
        }
      };
    }
    
    // 解析Range头部
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    
    if (start >= fileSize || end >= fileSize) {
      throw new Error('Range not satisfiable');
    }
    
    const chunkSize = end - start + 1;
    
    return {
      stream: await fs.readFile(filePath, { start, end }),
      size: chunkSize,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'application/octet-stream'
      }
    };
  }

  /**
   * 获取文件列表
   */
  async getFileList(page = 1, limit = 20) {
    const files = await fs.readdir(this.uploadDir);
    const validFiles = files.filter(f => f !== 'temp'); // 排除临时目录
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const pageFiles = validFiles.slice(startIndex, endIndex);
    
    const fileList = [];
    for (const fileId of pageFiles) {
      const filePath = path.join(this.uploadDir, fileId);
      const stats = await fs.stat(filePath);
      
      fileList.push({
        id: fileId,
        name: fileId, // 实际文件名可以存储在数据库中
        size: stats.size,
        type: this.getMimeType(filePath),
        uploadedAt: stats.birthtime.toISOString(),
        url: `/api/files/${fileId}/download`
      });
    }
    
    return {
      files: fileList,
      total: validFiles.length,
      page,
      limit,
      totalPages: Math.ceil(validFiles.length / limit)
    };
  }

  /**
   * 清理过期临时文件
   */
  async cleanupTempFiles() {
    const tempDirs = await fs.readdir(this.tempDir);
    
    for (const dir of tempDirs) {
      const dirPath = path.join(this.tempDir, dir);
      const infoPath = path.join(dirPath, 'info.json');
      
      if (await this.exists(infoPath)) {
        try {
          const info = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
          const expireTime = new Date(info.expiresAt).getTime();
          
          if (Date.now() > expireTime) {
            await fs.rm(dirPath, { recursive: true, force: true });
            console.log(`[FileStorage] 清理过期上传: ${dir}`);
          }
        } catch (error) {
          console.error(`[FileStorage] 清理临时文件失败:`, error);
        }
      }
    }
  }

  /**
   * 检查文件是否存在
   */
  async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件类型
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

module.exports = FileStorage;