/**
 * 文件存储 API
 * 支持分片上传、断点续传、大文件处理
 * 支持多种存储后端: Local, S3, MinIO, OSS, FTP
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// ============================================
// 存储抽象层 - BaseStorage
// ============================================

class BaseStorage {
  constructor(config = {}) {
    this.config = config;
    this.chunkSize = config.chunkSize || 1024 * 1024 * 5; // 5MB per chunk
    this.maxFileSize = config.maxFileSize || 1024 * 1024 * 1024; // 1GB
  }

  /**
   * 上传文件
   * @param {Buffer|Stream} file - 文件内容
   * @param {string} key - 文件键名
   * @param {object} options - 上传选项
   * @returns {Promise<object>} 上传结果
   */
  async upload(file, key, options = {}) {
    throw new Error('Method not implemented: upload()');
  }

  /**
   * 下载文件
   * @param {string} key - 文件键名
   * @param {object} options - 下载选项 (range等)
   * @returns {Promise<object>} 文件内容和元数据
   */
  async download(key, options = {}) {
    throw new Error('Method not implemented: download()');
  }

  /**
   * 删除文件
   * @param {string} key - 文件键名
   * @returns {Promise<boolean>} 是否成功
   */
  async delete(key) {
    throw new Error('Method not implemented: delete()');
  }

  /**
   * 检查文件是否存在
   * @param {string} key - 文件键名
   * @returns {Promise<boolean>} 是否存在
   */
  async exists(key) {
    throw new Error('Method not implemented: exists()');
  }

  /**
   * 列出文件
   * @param {string} prefix - 前缀
   * @param {object} options - 选项
   * @returns {Promise<object>} 文件列表
   */
  async list(prefix = '', options = {}) {
    throw new Error('Method not implemented: list()');
  }

  /**
   * 获取临时访问URL
   * @param {string} key - 文件键名
   * @param {number} expiresIn - 过期时间(秒)
   * @returns {Promise<string>} 临时URL
   */
  async getUrl(key, expiresIn = 3600) {
    throw new Error('Method not implemented: getUrl()');
  }

  /**
   * 获取文件元数据
   * @param {string} key - 文件键名
   * @returns {Promise<object>} 元数据
   */
  async getMetadata(key) {
    throw new Error('Method not implemented: getMetadata()');
  }

  /**
   * 带重试的操作
   * @param {Function} fn - 要执行的函数
   * @param {number} retries - 重试次数
   * @param {number} delay - 重试延迟(ms)
   */
  async withRetry(fn, retries = 3, delay = 1000) {
    let lastError;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }
    throw lastError;
  }

  /**
   * 验证配置
   */
  validateConfig() {
    throw new Error('Method not implemented: validateConfig()');
  }
}

// ============================================
// 本地存储 - LocalStorage
// ============================================

class LocalStorage extends BaseStorage {
  constructor(config = {}) {
    super(config);
    this.uploadDir = config.uploadDir || path.join(process.cwd(), 'uploads');
    this.tempDir = path.join(this.uploadDir, 'temp');
    this.cleanupInterval = config.cleanupInterval || 30 * 60 * 1000; // 30分钟清理临时文件
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    await fs.mkdir(this.uploadDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
    
    // 启动清理定时器
    this.cleanupTimer = setInterval(() => this.cleanupTempFiles(), this.cleanupInterval);
    
    this.initialized = true;
  }

  validateConfig() {
    if (!this.uploadDir) {
      throw new Error('LocalStorage: uploadDir is required');
    }
    return true;
  }

  async upload(file, key, options = {}) {
    await this.init();
    
    const filePath = path.join(this.uploadDir, key);
    const dir = path.dirname(filePath);
    
    await fs.mkdir(dir, { recursive: true });
    
    if (Buffer.isBuffer(file)) {
      await fs.writeFile(filePath, file);
    } else {
      // Stream
      const writeStream = require('fs').createWriteStream(filePath);
      await new Promise((resolve, reject) => {
        file.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }
    
    const stats = await fs.stat(filePath);
    
    return {
      key,
      size: stats.size,
      path: filePath,
      url: `/api/files/${key}/download`
    };
  }

  async download(key, options = {}) {
    await this.init();
    
    const filePath = path.join(this.uploadDir, key);
    
    if (!await this.exists(key)) {
      throw new Error('File not found');
    }
    
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;
    
    if (!options.range) {
      return {
        stream: await fs.readFile(filePath),
        size: fileSize,
        headers: {
          'Content-Length': fileSize,
          'Content-Type': options.contentType || 'application/octet-stream'
        }
      };
    }
    
    // 解析Range头部
    const parts = options.range.replace(/bytes=/, '').split('-');
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
        'Content-Type': options.contentType || 'application/octet-stream'
      }
    };
  }

  async delete(key) {
    await this.init();
    
    const filePath = path.join(this.uploadDir, key);
    
    if (await this.exists(key)) {
      await fs.unlink(filePath);
      return true;
    }
    return false;
  }

  async exists(key) {
    await this.init();
    
    const filePath = path.join(this.uploadDir, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix = '', options = {}) {
    await this.init();
    
    const page = options.page || 1;
    const limit = options.limit || 20;
    
    const allFiles = await this._listFiles(this.uploadDir, prefix);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const pageFiles = allFiles.slice(startIndex, endIndex);
    
    const fileList = [];
    for (const file of pageFiles) {
      const stats = await fs.stat(file.fullPath);
      fileList.push({
        key: file.relativePath,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        url: `/api/files/${file.relativePath}/download`
      });
    }
    
    return {
      files: fileList,
      total: allFiles.length,
      page,
      limit,
      totalPages: Math.ceil(allFiles.length / limit)
    };
  }

  async _listFiles(dir, prefix, basePath = '') {
    const results = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        if (entry.name !== 'temp') {
          const subFiles = await this._listFiles(fullPath, prefix, relativePath);
          results.push(...subFiles);
        }
      } else {
        if (!prefix || relativePath.startsWith(prefix)) {
          results.push({ fullPath, relativePath });
        }
      }
    }
    
    return results;
  }

  async getUrl(key, expiresIn = 3600) {
    // 本地存储不支持临时URL，返回普通下载URL
    return `/api/files/${key}/download`;
  }

  async getMetadata(key) {
    await this.init();
    
    const filePath = path.join(this.uploadDir, key);
    
    if (!await this.exists(key)) {
      throw new Error('File not found');
    }
    
    const stats = await fs.stat(filePath);
    
    return {
      key,
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      created: stats.birthtime.toISOString(),
      contentType: this._getMimeType(filePath)
    };
  }

  _getMimeType(filePath) {
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

  async cleanupTempFiles() {
    try {
      const tempDirs = await fs.readdir(this.tempDir);
      
      for (const dir of tempDirs) {
        const dirPath = path.join(this.tempDir, dir);
        const infoPath = path.join(dirPath, 'info.json');
        
        if (await this._existsFile(infoPath)) {
          try {
            const info = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
            const expireTime = new Date(info.expiresAt).getTime();
            
            if (Date.now() > expireTime) {
              await fs.rm(dirPath, { recursive: true, force: true });
              console.log(`[LocalStorage] 清理过期上传: ${dir}`);
            }
          } catch (error) {
            console.error(`[LocalStorage] 清理临时文件失败:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`[LocalStorage] 清理临时文件失败:`, error);
    }
  }

  async _existsFile(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================
// AWS S3 存储 - S3Storage
// ============================================

class S3Storage extends BaseStorage {
  constructor(config = {}) {
    super(config);
    this.endpoint = config.endpoint || 'https://s3.amazonaws.com';
    this.bucket = config.bucket;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.region = config.region || 'us-east-1';
    this.s3Client = null;
  }

  async _getClient() {
    if (this.s3Client) return this.s3Client;
    
    try {
      // 尝试使用 v3 SDK
      const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, 
              HeadObjectCommand, ListObjectsV2Command } = 
        require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      
      this.s3Client = new S3Client({
        endpoint: this.endpoint,
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey
        }
      });
      
      this._v3 = true;
      this._getSignedUrl = getSignedUrl;
      this._commands = { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, 
                         HeadObjectCommand, ListObjectsV2Command };
      
    } catch (e) {
      // 回退到 v2 SDK
      const AWS = require('aws-sdk');
      const s3 = new AWS.S3({
        endpoint: this.endpoint,
        region: this.region,
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey
      });
      
      this.s3Client = s3;
      this._v3 = false;
    }
    
    return this.s3Client;
  }

  validateConfig() {
    if (!this.bucket) throw new Error('S3Storage: bucket is required');
    if (!this.accessKeyId) throw new Error('S3Storage: accessKeyId is required');
    if (!this.secretAccessKey) throw new Error('S3Storage: secretAccessKey is required');
    return true;
  }

  async upload(file, key, options = {}) {
    const client = await this._getClient();
    
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: Buffer.isBuffer(file) ? file : file,
      ContentType: options.contentType || 'application/octet-stream'
    };
    
    if (options.metadata) {
      params.Metadata = options.metadata;
    }
    
    if (this._v3) {
      const command = new this._commands.PutObjectCommand(params);
      await this.withRetry(() => client.send(command));
    } else {
      await this.withRetry(() => client.putObject(params).promise());
    }
    
    return {
      key,
      bucket: this.bucket,
      url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`
    };
  }

  async download(key, options = {}) {
    const client = await this._getClient();
    
    const params = {
      Bucket: this.bucket,
      Key: key
    };
    
    if (options.range) {
      params.Range = options.range;
    }
    
    if (this._v3) {
      const command = new this._commands.GetObjectCommand(params);
      const response = await this.withRetry(() => client.send(command));
      
      const streamToBuffer = async (stream) => {
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      };
      
      const buffer = await streamToBuffer(response.Body);
      
      return {
        stream: buffer,
        size: response.ContentLength,
        headers: {
          'Content-Type': response.ContentType || 'application/octet-stream',
          'Content-Length': response.ContentLength
        }
      };
    } else {
      const response = await this.withRetry(() => client.getObject(params).promise());
      
      return {
        stream: response.Body,
        size: response.ContentLength,
        headers: {
          'Content-Type': response.ContentType || 'application/octet-stream',
          'Content-Length': response.ContentLength
        }
      };
    }
  }

  async delete(key) {
    const client = await this._getClient();
    
    const params = {
      Bucket: this.bucket,
      Key: key
    };
    
    if (this._v3) {
      const command = new this._commands.DeleteObjectCommand(params);
      await this.withRetry(() => client.send(command));
    } else {
      await this.withRetry(() => client.deleteObject(params).promise());
    }
    
    return true;
  }

  async exists(key) {
    const client = await this._getClient();
    
    const params = {
      Bucket: this.bucket,
      Key: key
    };
    
    try {
      if (this._v3) {
        const command = new this._commands.HeadObjectCommand(params);
        await client.send(command);
      } else {
        await client.headObject(params).promise();
      }
      return true;
    } catch (error) {
      if (error.code === 'NotFound' || error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async list(prefix = '', options = {}) {
    const client = await this._getClient();
    
    const params = {
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: options.limit || 1000
    };
    
    if (this._v3) {
      const command = new this._commands.ListObjectsV2Command(params);
      const response = await this.withRetry(() => client.send(command));
      
      const files = (response.Contents || []).map(item => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified?.toISOString(),
        url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${item.Key}`
      }));
      
      return {
        files,
        total: files.length,
        isTruncated: response.IsTruncated
      };
    } else {
      const response = await this.withRetry(() => client.listObjectsV2(params).promise());
      
      const files = (response.Contents || []).map(item => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified?.toISOString(),
        url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${item.Key}`
      }));
      
      return {
        files,
        total: files.length,
        isTruncated: response.IsTruncated
      };
    }
  }

  async getUrl(key, expiresIn = 3600) {
    const client = await this._getClient();
    
    const params = {
      Bucket: this.bucket,
      Key: key
    };
    
    if (this._v3) {
      const command = new this._commands.GetObjectCommand(params);
      return await this._getSignedUrl(client, command, { expiresIn });
    } else {
      return await client.getSignedUrlPromise('getObject', {
        ...params,
        Expires: expiresIn
      });
    }
  }

  async getMetadata(key) {
    const client = await this._getClient();
    
    const params = {
      Bucket: this.bucket,
      Key: key
    };
    
    if (this._v3) {
      const command = new this._commands.HeadObjectCommand(params);
      const response = await this.withRetry(() => client.send(command));
      
      return {
        key,
        size: response.ContentLength,
        lastModified: response.LastModified?.toISOString(),
        contentType: response.ContentType,
        metadata: response.Metadata
      };
    } else {
      const response = await this.withRetry(() => client.headObject(params).promise());
      
      return {
        key,
        size: response.ContentLength,
        lastModified: response.LastModified?.toISOString(),
        contentType: response.ContentType,
        metadata: response.Metadata
      };
    }
  }
}

// ============================================
// MinIO 存储 - MinIOStorage
// ============================================

class MinIOStorage extends BaseStorage {
  constructor(config = {}) {
    super(config);
    this.endpoint = config.endpoint || 'http://localhost:9000';
    this.bucket = config.bucket;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.useSSL = config.useSSL || this.endpoint.startsWith('https');
    this.port = config.port || (this.useSSL ? 443 : 9000);
    this.minioClient = null;
  }

  async _getClient() {
    if (this.minioClient) return this.minioClient;
    
    const Minio = require('minio');
    
    const url = new URL(this.endpoint);
    
    this.minioClient = new Minio.Client({
      endPoint: url.hostname,
      port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 9000),
      useSSL: url.protocol === 'https:',
      accessKey: this.accessKey,
      secretKey: this.secretKey
    });
    
    return this.minioClient;
  }

  validateConfig() {
    if (!this.bucket) throw new Error('MinIOStorage: bucket is required');
    if (!this.accessKey) throw new Error('MinIOStorage: accessKey is required');
    if (!this.secretKey) throw new Error('MinIOStorage: secretKey is required');
    return true;
  }

  async upload(file, key, options = {}) {
    const client = await this._getClient();
    
    // 确保bucket存在
    const bucketExists = await this.withRetry(() => client.bucketExists(this.bucket));
    if (!bucketExists) {
      await client.makeBucket(this.bucket, '');
    }
    
    const buffer = Buffer.isBuffer(file) ? file : await this._streamToBuffer(file);
    const metadata = {
      'Content-Type': options.contentType || 'application/octet-stream'
    };
    
    await this.withRetry(() => 
      client.putObject(this.bucket, key, buffer, buffer.length, metadata)
    );
    
    return {
      key,
      bucket: this.bucket,
      url: `${this.endpoint}/${this.bucket}/${key}`
    };
  }

  async download(key, options = {}) {
    const client = await this._getClient();
    
    const stream = await this.withRetry(() => client.getObject(this.bucket, key));
    const buffer = await this._streamToBuffer(stream);
    const stat = await this.withRetry(() => client.statObject(this.bucket, key));
    
    return {
      stream: buffer,
      size: stat.size,
      headers: {
        'Content-Type': stat.metaData?.['content-type'] || 'application/octet-stream',
        'Content-Length': stat.size
      }
    };
  }

  async delete(key) {
    const client = await this._getClient();
    await this.withRetry(() => client.removeObject(this.bucket, key));
    return true;
  }

  async exists(key) {
    const client = await this._getClient();
    try {
      await client.statObject(this.bucket, key);
      return true;
    } catch (error) {
      if (error.code === 'NotFound' || error.message?.includes('Not Found')) {
        return false;
      }
      throw error;
    }
  }

  async list(prefix = '', options = {}) {
    const client = await this._getClient();
    
    const files = [];
    const stream = client.listObjects(this.bucket, prefix, true);
    
    await new Promise((resolve, reject) => {
      stream.on('data', obj => {
        files.push({
          key: obj.name,
          size: obj.size,
          lastModified: obj.lastModified?.toISOString(),
          url: `${this.endpoint}/${this.bucket}/${obj.name}`
        });
      });
      stream.on('error', reject);
      stream.on('end', resolve);
    });
    
    return {
      files,
      total: files.length
    };
  }

  async getUrl(key, expiresIn = 3600) {
    const client = await this._getClient();
    return await client.presignedGetObject(this.bucket, key, expiresIn);
  }

  async getMetadata(key) {
    const client = await this._getClient();
    const stat = await this.withRetry(() => client.statObject(this.bucket, key));
    
    return {
      key,
      size: stat.size,
      lastModified: stat.lastModified?.toISOString(),
      contentType: stat.metaData?.['content-type'],
      metadata: stat.metaData
    };
  }

  async _streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}

// ============================================
// 阿里云 OSS 存储 - OSSStorage
// ============================================

class OSSStorage extends BaseStorage {
  constructor(config = {}) {
    super(config);
    this.endpoint = config.endpoint || 'https://oss-cn-hangzhou.aliyuncs.com';
    this.bucket = config.bucket;
    this.accessKeyId = config.accessKeyId;
    this.accessKeySecret = config.accessKeySecret;
    this.region = config.region || 'oss-cn-hangzhou';
    this.ossClient = null;
  }

  async _getClient() {
    if (this.ossClient) return this.ossClient;
    
    const OSS = require('ali-oss');
    
    this.ossClient = new OSS({
      region: this.region,
      endpoint: this.endpoint,
      bucket: this.bucket,
      accessKeyId: this.accessKeyId,
      accessKeySecret: this.accessKeySecret,
      secure: true
    });
    
    return this.ossClient;
  }

  validateConfig() {
    if (!this.bucket) throw new Error('OSSStorage: bucket is required');
    if (!this.accessKeyId) throw new Error('OSSStorage: accessKeyId is required');
    if (!this.accessKeySecret) throw new Error('OSSStorage: accessKeySecret is required');
    return true;
  }

  async upload(file, key, options = {}) {
    const client = await this._getClient();
    
    const buffer = Buffer.isBuffer(file) ? file : await this._streamToBuffer(file);
    
    const result = await this.withRetry(() => 
      client.put(key, buffer, {
        headers: {
          'Content-Type': options.contentType || 'application/octet-stream'
        }
      })
    );
    
    return {
      key,
      bucket: this.bucket,
      url: result.url
    };
  }

  async download(key, options = {}) {
    const client = await this._getClient();
    
    const result = await this.withRetry(() => client.get(key));
    
    return {
      stream: result.content,
      size: result.content.length,
      headers: {
        'Content-Type': result.res.headers['content-type'] || 'application/octet-stream',
        'Content-Length': result.content.length
      }
    };
  }

  async delete(key) {
    const client = await this._getClient();
    await this.withRetry(() => client.delete(key));
    return true;
  }

  async exists(key) {
    const client = await this._getClient();
    try {
      await client.head(key);
      return true;
    } catch (error) {
      if (error.status === 404 || error.code === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  async list(prefix = '', options = {}) {
    const client = await this._getClient();
    
    const result = await this.withRetry(() => 
      client.list({
        prefix,
        'max-keys': options.limit || 1000
      })
    );
    
    const files = (result.objects || []).map(item => ({
      key: item.name,
      size: item.size,
      lastModified: item.lastModified,
      url: item.url
    }));
    
    return {
      files,
      total: files.length,
      isTruncated: result.isTruncated
    };
  }

  async getUrl(key, expiresIn = 3600) {
    const client = await this._getClient();
    return await client.signatureUrl(key, { expires: expiresIn });
  }

  async getMetadata(key) {
    const client = await this._getClient();
    
    const result = await this.withRetry(() => client.head(key));
    
    return {
      key,
      size: parseInt(result.res.headers['content-length']),
      lastModified: result.res.headers['last-modified'],
      contentType: result.res.headers['content-type'],
      metadata: result.meta
    };
  }

  async _streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}

// ============================================
// FTP 存储 - FTPStorage
// ============================================

class FTPStorage extends BaseStorage {
  constructor(config = {}) {
    super(config);
    this.host = config.host;
    this.port = config.port || 21;
    this.user = config.user || 'anonymous';
    this.password = config.password || '';
    this.basePath = config.basePath || '/';
    this.secure = config.secure || false;
    this.ftpClient = null;
  }

  async _getClient() {
    if (this.ftpClient) return this.ftpClient;
    
    const ftp = require('basic-ftp');
    
    this.ftpClient = new ftp.Client();
    this.ftpClient.ftp.verbose = false;
    
    await this.ftpClient.access({
      host: this.host,
      port: this.port,
      user: this.user,
      password: this.password,
      secure: this.secure
    });
    
    return this.ftpClient;
  }

  async _closeClient() {
    if (this.ftpClient) {
      this.ftpClient.close();
      this.ftpClient = null;
    }
  }

  validateConfig() {
    if (!this.host) throw new Error('FTPStorage: host is required');
    return true;
  }

  async upload(file, key, options = {}) {
    const client = await this._getClient();
    
    const buffer = Buffer.isBuffer(file) ? file : await this._streamToBuffer(file);
    const remotePath = path.posix.join(this.basePath, key);
    const remoteDir = path.posix.dirname(remotePath);
    
    // 确保目录存在
    await client.ensureDir(remoteDir);
    
    // 上传文件
    const { Readable } = require('stream');
    const readable = Readable.from(buffer);
    
    await this.withRetry(async () => {
      await client.uploadFrom(readable, remotePath);
    });
    
    return {
      key,
      url: `ftp://${this.host}${remotePath}`
    };
  }

  async download(key, options = {}) {
    const client = await this._getClient();
    
    const remotePath = path.posix.join(this.basePath, key);
    const chunks = [];
    
    const { Writable } = require('stream');
    const writable = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      }
    });
    
    await this.withRetry(() => client.downloadTo(writable, remotePath));
    
    const buffer = Buffer.concat(chunks);
    
    return {
      stream: buffer,
      size: buffer.length,
      headers: {
        'Content-Type': options.contentType || 'application/octet-stream',
        'Content-Length': buffer.length
      }
    };
  }

  async delete(key) {
    const client = await this._getClient();
    
    const remotePath = path.posix.join(this.basePath, key);
    
    await this.withRetry(() => client.remove(remotePath));
    
    return true;
  }

  async exists(key) {
    const client = await this._getClient();
    
    const remotePath = path.posix.join(this.basePath, key);
    const remoteDir = path.posix.dirname(remotePath);
    const fileName = path.posix.basename(remotePath);
    
    try {
      const list = await client.list(remoteDir);
      return list.some(item => item.name === fileName);
    } catch (error) {
      return false;
    }
  }

  async list(prefix = '', options = {}) {
    const client = await this._getClient();
    
    const remotePath = path.posix.join(this.basePath, prefix);
    
    const list = await this.withRetry(() => client.list(remotePath));
    
    const files = list.map(item => ({
      key: path.posix.join(prefix, item.name),
      size: item.size,
      lastModified: item.modifiedAt?.toISOString(),
      isDirectory: item.isDirectory,
      url: `ftp://${this.host}${path.posix.join(this.basePath, prefix, item.name)}`
    }));
    
    return {
      files,
      total: files.length
    };
  }

  async getUrl(key, expiresIn = 3600) {
    // FTP 不支持临时URL，返回普通URL
    const remotePath = path.posix.join(this.basePath, key);
    return `ftp://${this.host}${remotePath}`;
  }

  async getMetadata(key) {
    const client = await this._getClient();
    
    const remotePath = path.posix.join(this.basePath, key);
    const remoteDir = path.posix.dirname(remotePath);
    const fileName = path.posix.basename(remotePath);
    
    const list = await this.withRetry(() => client.list(remoteDir));
    const item = list.find(i => i.name === fileName);
    
    if (!item) {
      throw new Error('File not found');
    }
    
    return {
      key,
      size: item.size,
      lastModified: item.modifiedAt?.toISOString(),
      isDirectory: item.isDirectory
    };
  }

  async _streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}

// ============================================
// 存储工厂 - StorageFactory
// ============================================

class StorageFactory {
  static providers = {
    local: LocalStorage,
    s3: S3Storage,
    minio: MinIOStorage,
    oss: OSSStorage,
    ftp: FTPStorage
  };

  /**
   * 创建存储实例
   * @param {string} type - 存储类型
   * @param {object} config - 配置
   * @returns {BaseStorage} 存储实例
   */
  static create(type, config = {}) {
    const ProviderClass = this.providers[type.toLowerCase()];
    
    if (!ProviderClass) {
      throw new Error(`Unknown storage provider: ${type}. Available: ${Object.keys(this.providers).join(', ')}`);
    }
    
    const instance = new ProviderClass(config);
    instance.validateConfig();
    
    return instance;
  }

  /**
   * 注册自定义存储提供商
   * @param {string} type - 类型名称
   * @param {class} ProviderClass - 存储类
   */
  static register(type, ProviderClass) {
    if (!(ProviderClass.prototype instanceof BaseStorage)) {
      throw new Error('Provider must extend BaseStorage');
    }
    this.providers[type.toLowerCase()] = ProviderClass;
  }

  /**
   * 获取所有支持的存储类型
   * @returns {string[]} 存储类型列表
   */
  static getSupportedTypes() {
    return Object.keys(this.providers);
  }
}

// ============================================
// 文件存储管理器 - FileStorageManager
// ============================================

class FileStorageManager {
  constructor(config = {}) {
    this.config = config;
    this.defaultProvider = config.default || 'local';
    this.providers = {};
    this.tempDir = config.tempDir || path.join(process.cwd(), 'uploads', 'temp');
    this.chunkSize = config.chunkSize || 1024 * 1024 * 5; // 5MB
    this.maxFileSize = config.maxFileSize || 1024 * 1024 * 1024; // 1GB
    this.cleanupInterval = config.cleanupInterval || 30 * 60 * 1000; // 30分钟
    this.uploadSessions = new Map();
    
    this._initProviders();
  }

  _initProviders() {
    const providersConfig = this.config.providers || {};
    
    // 如果没有配置providers，创建默认的本地存储
    if (Object.keys(providersConfig).length === 0) {
      providersConfig.local = {
        type: 'local',
        uploadDir: path.join(process.cwd(), 'uploads')
      };
    }
    
    // 初始化所有配置的provider
    for (const [name, providerConfig] of Object.entries(providersConfig)) {
      try {
        this.providers[name] = StorageFactory.create(providerConfig.type, providerConfig);
        console.log(`[FileStorageManager] 初始化存储提供商: ${name} (${providerConfig.type})`);
      } catch (error) {
        console.error(`[FileStorageManager] 初始化存储提供商失败 ${name}:`, error.message);
      }
    }
  }

  /**
   * 获取存储提供商
   * @param {string} name - 提供商名称，默认使用defaultProvider
   * @returns {BaseStorage} 存储实例
   */
  getProvider(name = null) {
    const providerName = name || this.defaultProvider;
    const provider = this.providers[providerName];
    
    if (!provider) {
      throw new Error(`Storage provider not found: ${providerName}`);
    }
    
    return provider;
  }

  /**
   * 初始化分片上传
   */
  async initUpload(fileInfo, providerName = null) {
    const provider = this.getProvider(providerName);
    
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
      provider: providerName || this.defaultProvider,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    // 创建上传会话目录
    await fs.mkdir(this.tempDir, { recursive: true });
    const uploadPath = path.join(this.tempDir, uploadId);
    await fs.mkdir(uploadPath, { recursive: true });
    
    // 保存上传信息
    await fs.writeFile(
      path.join(uploadPath, 'info.json'),
      JSON.stringify(uploadInfo)
    );
    
    this.uploadSessions.set(uploadId, uploadInfo);
    
    return uploadInfo;
  }

  /**
   * 上传分片
   */
  async uploadChunk(uploadId, chunkIndex, chunkData, chunkHash) {
    const uploadPath = path.join(this.tempDir, uploadId);
    const infoPath = path.join(uploadPath, 'info.json');
    
    if (!await this._exists(infoPath)) {
      throw new Error('Upload session not found');
    }
    
    const info = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
    
    if (chunkIndex >= info.totalChunks) {
      throw new Error('Invalid chunk index');
    }
    
    if (chunkData.length > this.chunkSize) {
      throw new Error('Chunk size exceeds limit');
    }
    
    // 验证分片哈希
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
    
    this.uploadSessions.set(uploadId, info);
    
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
    
    if (!await this._exists(infoPath)) {
      throw new Error('Upload session not found');
    }
    
    const info = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
    
    if (info.uploadedChunks.length !== info.totalChunks) {
      throw new Error('Not all chunks uploaded');
    }
    
    // 按序号排序分片并合并
    const sortedChunks = info.uploadedChunks.sort((a, b) => a - b);
    const chunks = [];
    
    for (const chunkIndex of sortedChunks) {
      const chunkPath = path.join(uploadPath, `chunk_${chunkIndex}`);
      chunks.push(await fs.readFile(chunkPath));
    }
    
    const fileBuffer = Buffer.concat(chunks);
    
    // 计算文件哈希
    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    
    // 上传到存储提供商
    const provider = this.getProvider(info.provider);
    const result = await provider.upload(fileBuffer, info.fileId, {
      contentType: info.mimeType
    });
    
    // 更新信息
    info.status = 'completed';
    info.completedAt = new Date().toISOString();
    info.fileHash = fileHash;
    info.result = result;
    await fs.writeFile(infoPath, JSON.stringify(info));
    
    // 删除临时文件
    await fs.rm(uploadPath, { recursive: true, force: true });
    this.uploadSessions.delete(uploadId);
    
    return {
      fileId: info.fileId,
      fileName: info.fileName,
      fileSize: info.fileSize,
      mimeType: info.mimeType,
      fileHash: fileHash,
      downloadUrl: `/api/files/${info.fileId}/download`,
      ...result
    };
  }

  /**
   * 获取上传进度
   */
  async getProgress(uploadId) {
    const uploadPath = path.join(this.tempDir, uploadId);
    const infoPath = path.join(uploadPath, 'info.json');
    
    if (!await this._exists(infoPath)) {
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
  async downloadFile(fileId, options = {}, providerName = null) {
    const provider = this.getProvider(providerName);
    return await provider.download(fileId, options);
  }

  /**
   * 删除文件
   */
  async deleteFile(fileId, providerName = null) {
    const provider = this.getProvider(providerName);
    return await provider.delete(fileId);
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(fileId, providerName = null) {
    const provider = this.getProvider(providerName);
    return await provider.exists(fileId);
  }

  /**
   * 获取文件列表
   */
  async getFileList(options = {}, providerName = null) {
    const provider = this.getProvider(providerName);
    return await provider.list(options.prefix || '', options);
  }

  /**
   * 获取临时访问URL
   */
  async getFileUrl(fileId, expiresIn = 3600, providerName = null) {
    const provider = this.getProvider(providerName);
    return await provider.getUrl(fileId, expiresIn);
  }

  /**
   * 清理过期上传会话
   */
  async cleanupExpiredSessions() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      const tempDirs = await fs.readdir(this.tempDir);
      
      for (const dir of tempDirs) {
        const dirPath = path.join(this.tempDir, dir);
        const infoPath = path.join(dirPath, 'info.json');
        
        if (await this._exists(infoPath)) {
          try {
            const info = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
            const expireTime = new Date(info.expiresAt).getTime();
            
            if (Date.now() > expireTime) {
              await fs.rm(dirPath, { recursive: true, force: true });
              this.uploadSessions.delete(dir);
              console.log(`[FileStorageManager] 清理过期上传: ${dir}`);
            }
          } catch (error) {
            console.error(`[FileStorageManager] 清理会话失败:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`[FileStorageManager] 清理会话失败:`, error);
    }
  }

  async _exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================
// 向后兼容的 FileStorage 类
// ============================================

class FileStorage extends FileStorageManager {
  constructor(options = {}) {
    // 将旧的配置格式转换为新的格式
    const config = {
      default: 'local',
      providers: {
        local: {
          type: 'local',
          uploadDir: options.uploadDir || path.join(process.cwd(), 'uploads'),
          chunkSize: options.chunkSize,
          maxFileSize: options.maxFileSize,
          cleanupInterval: options.cleanupInterval
        }
      },
      tempDir: options.uploadDir ? path.join(options.uploadDir, 'temp') : undefined,
      chunkSize: options.chunkSize,
      maxFileSize: options.maxFileSize,
      cleanupInterval: options.cleanupInterval
    };
    
    super(config);
  }

  // 保持向后兼容的初始化方法
  async init() {
    await fs.mkdir(this.tempDir, { recursive: true });
    
    if (this.cleanupInterval) {
      setInterval(() => this.cleanupExpiredSessions(), this.cleanupInterval);
    }
  }

  // 保持向后兼容的清理方法
  async cleanupTempFiles() {
    return this.cleanupExpiredSessions();
  }

  // 保持向后兼容的exists方法
  async exists(filePath) {
    return this._exists(filePath);
  }

  // 保持向后兼容的getMimeType方法
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

// ============================================
// 导出
// ============================================

module.exports = {
  // 主要类
  FileStorage,
  FileStorageManager,
  StorageFactory,
  
  // 存储提供商
  BaseStorage,
  LocalStorage,
  S3Storage,
  MinIOStorage,
  OSSStorage,
  FTPStorage,
  
  // 默认导出（向后兼容）
  default: FileStorage
};