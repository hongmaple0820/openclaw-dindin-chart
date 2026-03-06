/**
 * 图片生成器
 * 整合 ClawMate 能力
 */
import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';
import Database from 'better-sqlite3';
import os from 'os';

type SqliteDatabase = ReturnType<typeof Database>;

// 类型定义
export interface SelfieOptions {
  mode?: string;
  scene?: string;
  emotion?: string;
  prompt?: string;
}

export interface GeneratedImage {
  id?: number;
  character_id: string;
  file_path: string;
  file_url: string;
  prompt: string;
  mode: string;
  provider: string;
  request_id?: string;
  metadata?: string;
  created_at?: number;
}

export interface GenerateSelfieResult {
  ok: boolean;
  id?: number;
  characterId?: string;
  mode?: string;
  provider?: string;
  imageUrl?: string;
  filePath?: string;
  prompt?: string;
  error?: string;
}

export interface MockSelfieResult {
  filePath: string;
  fileUrl: string;
}

class ImageGeneratorClass {
  private db: SqliteDatabase;
  private mediaRoot: string;
  private clawmateUrl: string;

  constructor() {
    const dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'messages.db');
    this.db = Database(dbPath);
    this.mediaRoot = path.join(os.homedir(), '.openclaw', 'media');
    
    // ClawMate 配置
    this.clawmateUrl = process.env.CLAWMATE_URL || 'http://localhost:9527';
  }
  
  /**
   * 生成自拍
   */
  async generateSelfie(characterId: string, options: SelfieOptions = {}): Promise<GenerateSelfieResult> {
    const { mode = 'direct', scene, emotion, prompt } = options;
    
    try {
      console.log(`[ImageGenerator] 为角色 ${characterId} 生成自拍...`);
      
      // 方式 1: 调用 ClawMate 插件（如果可用）
      // 方式 2: 使用 mock 图片（开发阶段）
      
      // 暂时使用 mock 模式
      const mockImage = await this.generateMockSelfie(characterId, mode, emotion);
      
      // 保存到数据库
      const stmt = this.db.prepare(`
        INSERT INTO generated_images (
          character_id, file_path, file_url, prompt, mode, 
          provider, request_id, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        characterId,
        mockImage.filePath,
        mockImage.fileUrl,
        prompt || `${emotion || 'happy'} selfie`,
        mode,
        'mock',
        `mock_${Date.now()}`,
        JSON.stringify({ emotion, scene })
      );
      
      return {
        ok: true,
        id: result.lastInsertRowid,
        characterId,
        mode,
        provider: 'mock',
        imageUrl: mockImage.fileUrl,
        filePath: mockImage.filePath,
        prompt: prompt || `${emotion || 'happy'} selfie`
      };
    } catch (error) {
      console.error('[ImageGenerator] 生成失败:', (error as Error).message);
      return {
        ok: false,
        error: (error as Error).message
      };
    }
  }
  
  /**
   * 生成 Mock 自拍（开发阶段）
   */
  private async generateMockSelfie(characterId: string, _mode: string, emotion?: string): Promise<MockSelfieResult> {
    const timestamp = Date.now();
    const filename = `selfie_${characterId}_${timestamp}.jpg`;
    const relativePath = `clawmate-generated/${new Date().toISOString().split('T')[0]}/${filename}`;
    const fullPath = path.join(this.mediaRoot, relativePath);
    
    // 确保目录存在
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    // 创建一个简单的占位图片（1x1 像素）
    const mockImageData = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x03, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
      0x7F, 0x80, 0xFF, 0xD9
    ]);
    
    await fs.writeFile(fullPath, mockImageData);
    
    return {
      filePath: fullPath,
      fileUrl: `http://localhost:8273/media/${relativePath}`
    };
  }
  
  /**
   * 获取最近的自拍
   */
  async getRecentImages(characterId: string, limit: number = 20): Promise<GeneratedImage[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM generated_images 
      WHERE character_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    
    return stmt.all(characterId, limit) as GeneratedImage[];
  }
  
  /**
   * 获取所有角色的最近自拍
   */
  async getAllRecentImages(limit: number = 50): Promise<(GeneratedImage & { character_name?: string })[]> {
    const stmt = this.db.prepare(`
      SELECT gi.*, c.name as character_name 
      FROM generated_images gi
      LEFT JOIN characters c ON gi.character_id = c.id
      ORDER BY gi.created_at DESC 
      LIMIT ?
    `);
    
    return stmt.all(limit) as (GeneratedImage & { character_name?: string })[];
  }
}

const ImageGenerator = new ImageGeneratorClass();
export default ImageGenerator;