/**
 * 文件存储 API
 * 支持分片上传、断点续传、大文件处理
 * 支持多种存储后端: Local, S3, MinIO, OSS, FTP
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Readable, Writable } from 'stream';

// ============================================
// 类型定义
// ============================================

interface BaseStorageConfig {
  chunkSize?: number;
  maxFileSize?: number;
}

interface UploadResult {
  key: string;
  size?: number;
  path?: string;
  url: string;
  bucket?: string;
}

interface DownloadResult {
  stream: Buffer;
  size: number;
  headers: Record<string, string | number>;
}

interface FileListOptions {
  page?: number;
  limit?: number;
  prefix?: string;
}

interface FileListItem {
  key: string;
  size: number;
  lastModified?: string;
  url: string;
  isDirectory?: boolean;
}

interface FileListResult {
  files: FileListItem[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  isTruncated?: boolean;
}

interface FileMetadata {
  key: string;
  size: number;
  lastModified?: string;
  created?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  isDirectory?: boolean;
}

// ============================================
// 存储抽象层 - BaseStorage
// ============================================

abstract class BaseStorage {
  protected config: BaseStorageConfig;
  protected chunkSize: number;
  protected maxFileSize: number;

  constructor(config: BaseStorageConfig = {}) {
    this.config = config;
    this.chunkSize = config.chunkSize || 1024 * 1024 * 5; // 5MB per chunk
    this.maxFileSize = config.maxFileSize || 1024 * 1024 * 1024; // 1GB
  }

  abstract upload(file: Buffer | Readable, key: string, options?: { contentType?: string; metadata?: Record<string, string> }): Promise<UploadResult>;
  abstract download(key: string, options?: { range?: string; contentType?: string }): Promise<DownloadResult>;
  abstract delete(key: string): Promise<boolean>;
  abstract exists(key: string): Promise<boolean>;
  abstract list(prefix?: string, options?: FileListOptions): Promise<FileListResult>;
  abstract getUrl(key: string, expiresIn?: number): Promise<string>;
  abstract getMetadata(key: string): Promise<FileMetadata>;
  abstract validateConfig(): boolean;

  async withRetry<T>(fn: () => Promise<T>, retries: number = 3, delay: number = 1000): Promise<T> {
    let lastError: Error | undefined;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }
    throw lastError;
  }
}

// ============================================
// 本地存储 - LocalStorage
// ============================================

interface LocalStorageConfig extends BaseStorageConfig {
  uploadDir?: string;
  cleanupInterval?: number;
}

class LocalStorage extends BaseStorage {
  private uploadDir: string;
  private tempDir: string;
  private cleanupInterval: number;
  private initialized: boolean;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: LocalStorageConfig = {}) {
    super(config);
    this.uploadDir = config.uploadDir || path.join(process.cwd(), 'uploads');
    this.tempDir = path.join(this.uploadDir, 'temp');
    this.cleanupInterval = config.cleanupInterval || 30 * 60 * 1000; // 30分钟清理临时文件
    this.initialized = false;
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    
    await fs.mkdir(this.uploadDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
    
    // 启动清理定时器
    this.cleanupTimer = setInterval(() => this.cleanupTempFiles(), this.cleanupInterval);
    
    this.initialized = true;
  }

  validateConfig(): boolean {
    if (!this.uploadDir) {
      throw new Error('LocalStorage: uploadDir is required');
    }
    return true;
  }

  async upload(file: Buffer | Readable, key: string, options: { contentType?: string; metadata?: Record<string, string> } = {}): Promise<UploadResult> {
    await this.init();
    
    const filePath = path.join(this.uploadDir, key);
    const dir = path.dirname(filePath);
    
    await fs.mkdir(dir, { recursive: true });
    
    if (Buffer.isBuffer(file)) {
      await fs.writeFile(filePath, file);
    } else {
      // Stream
      const writeStream = require('fs').createWriteStream(filePath);
      await new Promise<void>((resolve, reject) => {
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

  async download(key: string, options: { range?: string; contentType?: string } = {}): Promise<DownloadResult> {
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
      stream: await fs.readFile(filePath, { start, end } as fs.BaseEncodingOptions & { start?: number; end?: number }),
      size: chunkSize,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': options.contentType || 'application/octet-stream'
      }
    };
  }

  async delete(key: string): Promise<boolean> {
    await this.init();
    
    const filePath = path.join(this.uploadDir, key);
    
    if (await this.exists(key)) {
      await fs.unlink(filePath);
      return true;
    }
    return false;
  }

  async exists(key: string): Promise<boolean> {
    await this.init();
    
    const filePath = path.join(this.uploadDir, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string = '', options: FileListOptions = {}): Promise<FileListResult> {
    await this.init();
    
    const page = options.page || 1;
    const limit = options.limit || 20;
    
    const allFiles = await this._listFiles(this.uploadDir, prefix);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const pageFiles = allFiles.slice(startIndex, endIndex);
    
    const fileList: FileListItem[] = [];
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

  private async _listFiles(dir: string, prefix: string, basePath: string = ''): Promise<{ fullPath: string; relativePath: string }[]> {
    const results: { fullPath: string; relativePath: string }[] = [];
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

  async getUrl(key: string, _expiresIn: number = 3600): Promise<string> {
    // 本地存储不支持临时URL，返回普通下载URL
    return `/api/files/${key}/download`;
  }

  async getMetadata(key: string): Promise<FileMetadata> {
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

  private _getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
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

  private async cleanupTempFiles(): Promise<void> {
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

  private async _existsFile(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================
// 存储工厂 - StorageFactory
// ============================================

type StorageType = 'local' | 's3' | 'minio' | 'oss' | 'ftp';

interface StorageProviderConfig extends BaseStorageConfig {
  type: StorageType;
  uploadDir?: string;
  bucket?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  accessKeySecret?: string;
  accessKey?: string;
  secretKey?: string;
  region?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  basePath?: string;
  secure?: boolean;
  cleanupInterval?: number;
}

class StorageFactory {
  static providers: Record<string, new (config: StorageProviderConfig) => BaseStorage> = {
    local: LocalStorage as unknown as new (config: StorageProviderConfig) => BaseStorage,
    // s3: S3Storage,
    // minio: MinIOStorage,
    // oss: OSSStorage,
    // ftp: FTPStorage
  };

  static create(type: string, config: StorageProviderConfig = {}): BaseStorage {
    const ProviderClass = this.providers[type.toLowerCase()];
    
    if (!ProviderClass) {
      throw new Error(`Unknown storage provider: ${type}. Available: ${Object.keys(this.providers).join(', ')}`);
    }
    
    const instance = new ProviderClass(config);
    instance.validateConfig();
    
    return instance;
  }

  static register(type: string, ProviderClass: new (config: StorageProviderConfig) => BaseStorage): void {
    this.providers[type.toLowerCase()] = ProviderClass;
  }

  static getSupportedTypes(): string[] {
    return Object.keys(this.providers);
  }
}

// ============================================
// 文件存储管理器 - FileStorageManager
// ============================================

interface FileStorageManagerConfig {
  default?: string;
  providers?: Record<string, StorageProviderConfig>;
  tempDir?: string;
  chunkSize?: number;
  maxFileSize?: number;
  cleanupInterval?: number;
}

interface UploadInfo {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  uploadedChunks: number[];
  status: string;
  provider: string;
  createdAt: string;
  expiresAt: string;
  fileHash?: string;
  result?: UploadResult;
  completedAt?: string;
}

interface FileInfo {
  name: string;
  size: number;
  type: string;
}

interface Progress {
  uploadId: string;
  status: string;
  uploadedChunks: number;
  totalChunks: number;
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
}

class FileStorageManager {
  protected config: FileStorageManagerConfig;
  protected defaultProvider: string;
  protected providers: Record<string, BaseStorage> = {};
  protected tempDir: string;
  protected chunkSize: number;
  protected maxFileSize: number;
  protected cleanupInterval: number;
  protected uploadSessions: Map<string, UploadInfo> = new Map();

  constructor(config: FileStorageManagerConfig = {}) {
    this.config = config;
    this.defaultProvider = config.default || 'local';
    this.tempDir = config.tempDir || path.join(process.cwd(), 'uploads', 'temp');
    this.chunkSize = config.chunkSize || 1024 * 1024 * 5; // 5MB
    this.maxFileSize = config.maxFileSize || 1024 * 1024 * 1024; // 1GB
    this.cleanupInterval = config.cleanupInterval || 30 * 60 * 1000; // 30分钟
    this.uploadSessions = new Map();
    
    this._initProviders();
  }

  private _initProviders(): void {
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
        console.error(`[FileStorageManager] 初始化存储提供商失败 ${name}:`, (error as Error).message);
      }
    }
  }

  getProvider(name: string | null = null): BaseStorage {
    const providerName = name || this.defaultProvider;
    const provider = this.providers[providerName];
    
    if (!provider) {
      throw new Error(`Storage provider not found: ${providerName}`);
    }
    
    return provider;
  }

  async initUpload(fileInfo: FileInfo, providerName: string | null = null): Promise<UploadInfo> {
    const provider = this.getProvider(providerName);
    
    const fileId = uuidv4();
    const uploadId = uuidv4();
    const totalChunks = Math.ceil(fileInfo.size / this.chunkSize);
    
    const uploadInfo: UploadInfo = {
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

  async uploadChunk(uploadId: string, chunkIndex: number, chunkData: Buffer, chunkHash?: string): Promise<{ uploadId: string; chunkIndex: number; completed: boolean }> {
    const uploadPath = path.join(this.tempDir, uploadId);
    const infoPath = path.join(uploadPath, 'info.json');
    
    if (!await this._exists(infoPath)) {
      throw new Error('Upload session not found');
    }
    
    const info: UploadInfo = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
    
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

  async completeUpload(uploadId: string): Promise<UploadResult & { fileId: string; fileName: string; fileSize: number; mimeType: string; fileHash: string; downloadUrl: string }> {
    const uploadPath = path.join(this.tempDir, uploadId);
    const infoPath = path.join(uploadPath, 'info.json');
    
    if (!await this._exists(infoPath)) {
      throw new Error('Upload session not found');
    }
    
    const info: UploadInfo = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
    
    if (info.uploadedChunks.length !== info.totalChunks) {
      throw new Error('Not all chunks uploaded');
    }
    
    // 按序号排序分片并合并
    const sortedChunks = info.uploadedChunks.sort((a, b) => a - b);
    const chunks: Buffer[] = [];
    
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

  async getProgress(uploadId: string): Promise<Progress> {
    const uploadPath = path.join(this.tempDir, uploadId);
    const infoPath = path.join(uploadPath, 'info.json');
    
    if (!await this._exists(infoPath)) {
      throw new Error('Upload session not found');
    }
    
    const info: UploadInfo = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
    
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

  async downloadFile(fileId: string, options: { range?: string; contentType?: string } = {}, providerName: string | null = null): Promise<DownloadResult> {
    const provider = this.getProvider(providerName);
    return await provider.download(fileId, options);
  }

  async deleteFile(fileId: string, providerName: string | null = null): Promise<boolean> {
    const provider = this.getProvider(providerName);
    return await provider.delete(fileId);
  }

  async fileExists(fileId: string, providerName: string | null = null): Promise<boolean> {
    const provider = this.getProvider(providerName);
    return await provider.exists(fileId);
  }

  async getFileList(options: FileListOptions = {}, providerName: string | null = null): Promise<FileListResult> {
    const provider = this.getProvider(providerName);
    return await provider.list(options.prefix || '', options);
  }

  async getFileUrl(fileId: string, expiresIn: number = 3600, providerName: string | null = null): Promise<string> {
    const provider = this.getProvider(providerName);
    return await provider.getUrl(fileId, expiresIn);
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      const tempDirs = await fs.readdir(this.tempDir);
      
      for (const dir of tempDirs) {
        const dirPath = path.join(this.tempDir, dir);
        const infoPath = path.join(dirPath, 'info.json');
        
        if (await this._exists(infoPath)) {
          try {
            const info: UploadInfo = JSON.parse(await fs.readFile(infoPath, 'utf-8'));
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

  protected async _exists(filePath: string): Promise<boolean> {
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

interface FileStorageOptions extends LocalStorageConfig {
  uploadDir?: string;
}

class FileStorage extends FileStorageManager {
  constructor(options: FileStorageOptions = {}) {
    // 将旧的配置格式转换为新的格式
    const config: FileStorageManagerConfig = {
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
  async init(): Promise<void> {
    await fs.mkdir(this.tempDir || path.join(process.cwd(), 'uploads', 'temp'), { recursive: true });
  }

  // 保持向后兼容的清理方法
  async cleanupTempFiles(): Promise<void> {
    return this.cleanupExpiredSessions();
  }

  // 保持向后兼容的exists方法
  async exists(filePath: string): Promise<boolean> {
    return this._exists(filePath);
  }

  // 保持向后兼容的getMimeType方法
  getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
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

export {
  // 主要类
  FileStorage,
  FileStorageManager,
  StorageFactory,
  
  // 存储提供商
  BaseStorage,
  LocalStorage,
  
  // 类型
  FileStorageManagerConfig,
  UploadInfo,
  UploadResult,
  DownloadResult,
  FileListResult,
  FileMetadata,
  Progress
};