/**
 * 音频上传路由
 * 支持语音消息的上传、获取和转换
 * 
 * @author 小琳
 * @date 2026-03-06
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const audioUpload = require('../audio-upload');
import type { Request, Response } from 'express';

const router = express.Router();

// 创建上传中间件
const upload = audioUpload.createUploadMiddleware();

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  path: string;
  filename: string;
  buffer?: Buffer;
  destination?: string;
  stream?: NodeJS.ReadableStream;
}

type RequestWithFile = Request & {
  file?: UploadedFile;
};

interface AudioData {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  duration?: number;
}

interface UploadBody {
  uploadedBy?: string;
  messageId?: string;
}

/**
 * 上传语音文件
 * POST /api/audio/upload
 */
router.post('/upload', upload.single('audio'), async (req: Request, res: Response): Promise<void> => {
  try {
    const request = req as RequestWithFile;
    if (!request.file) {
      res.status(400).json({ 
        success: false, 
        error: '请选择要上传的音频文件' 
      });
      return;
    }

    const uploadedBy = req.body.uploadedBy || 'anonymous';
    const messageId = req.body.messageId || null;

    // 处理上传的文件
    const audioData = await audioUpload.processUploadedFile(
      request.file, 
      uploadedBy, 
      messageId
    ) as AudioData;

    // 如果是 AMR 格式，生成 MP3 版本（用于浏览器播放）
    let mp3Url: string | null = null;
    if (request.file.mimetype === 'audio/amr' || request.file.originalname?.endsWith('.amr')) {
      try {
        const mp3Path = await audioUpload.convertAmrToMp3(request.file.path);
        if (mp3Path !== request.file.path) {
          mp3Url = `/api/audio/file/${path.basename(mp3Path)}`;
        }
      } catch (convertError) {
        console.warn('[Audio] AMR 转换失败，浏览器可能无法播放:', (convertError as Error).message);
      }
    }

    res.json({
      success: true,
      data: {
        id: audioData.id,
        filename: audioData.filename,
        originalName: audioData.originalName,
        url: `/api/audio/file/${audioData.filename}`,
        mp3Url, // 转换后的 MP3 URL（如果有）
        mimeType: audioData.mimeType,
        fileSize: audioData.fileSize,
        formattedSize: audioUpload.formatFileSize(audioData.fileSize),
        duration: audioData.duration,
        formattedDuration: audioUpload.formatDuration(audioData.duration || 0)
      }
    });
  } catch (error) {
    console.error('[Audio] 上传失败:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    });
  }
});

/**
 * 获取音频文件
 * GET /api/audio/file/:filename
 */
router.get('/file/:filename', (req: Request<{ filename: string }>, res: Response): void => {
  try {
    const { filename } = req.params;
    const audioPath = path.join(audioUpload.audioDir, filename);

    if (!fs.existsSync(audioPath)) {
      res.status(404).json({ 
        success: false, 
        error: '音频文件不存在' 
      });
      return;
    }

    // 设置响应头，支持 Range 请求（音频流式播放）
    const stat = fs.statSync(audioPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // 确定 MIME 类型
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.amr': 'audio/amr',
      '.aac': 'audio/aac',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.webm': 'audio/webm',
      '.3gp': 'audio/3gpp'
    };
    const mimeType = mimeMap[ext] || 'audio/mpeg';

    if (range) {
      // Range 请求（流式播放）
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(audioPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000'
      });
      file.pipe(res);
    } else {
      // 完整文件
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Accept-Ranges', 'bytes');
      fs.createReadStream(audioPath).pipe(res);
    }
  } catch (error) {
    console.error('[Audio] 获取音频失败:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    });
  }
});

/**
 * 获取音频信息
 * GET /api/audio/info/:filename
 */
router.get('/info/:filename', (req: Request<{ filename: string }>, res: Response): void => {
  try {
    const { filename } = req.params;
    const audioPath = path.join(audioUpload.audioDir, filename);

    if (!fs.existsSync(audioPath)) {
      res.status(404).json({ 
        success: false, 
        error: '音频文件不存在' 
      });
      return;
    }

    const stat = fs.statSync(audioPath);
    const ext = path.extname(filename).toLowerCase();
    
    res.json({
      success: true,
      data: {
        filename,
        size: stat.size,
        formattedSize: audioUpload.formatFileSize(stat.size),
        mimeType: `audio/${ext.slice(1)}`,
        url: `/api/audio/file/${filename}`,
        createdAt: stat.birthtime
      }
    });
  } catch (error) {
    console.error('[Audio] 获取音频信息失败:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    });
  }
});

/**
 * 删除音频文件
 * DELETE /api/audio/file/:filename
 */
router.delete('/file/:filename', async (req: Request<{ filename: string }>, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    const audioPath = path.join(audioUpload.audioDir, filename);
    
    // 同时删除可能的转换文件
    const mp3Path = audioPath.replace(/\.[^.]+$/, '.mp3');
    
    let deleted = false;
    if (fs.existsSync(audioPath)) {
      audioUpload.deleteAudioFile(audioPath);
      deleted = true;
    }
    
    // 删除转换的 MP3
    if (fs.existsSync(mp3Path) && mp3Path !== audioPath) {
      audioUpload.deleteAudioFile(mp3Path);
    }

    if (deleted) {
      res.json({ 
        success: true, 
        message: '音频已删除' 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: '音频不存在或删除失败' 
      });
    }
  } catch (error) {
    console.error('[Audio] 删除音频失败:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    });
  }
});

/**
 * AMR 转 MP3 接口（手动触发转换）
 * POST /api/audio/convert
 */
router.post('/convert', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      res.status(400).json({
        success: false,
        error: '请提供文件名'
      });
      return;
    }

    const audioPath = path.join(audioUpload.audioDir, filename);
    
    if (!fs.existsSync(audioPath)) {
      res.status(404).json({
        success: false,
        error: '音频文件不存在'
      });
      return;
    }

    const mp3Path = await audioUpload.convertAmrToMp3(audioPath);
    
    if (mp3Path !== audioPath) {
      res.json({
        success: true,
        data: {
          original: filename,
          converted: path.basename(mp3Path),
          mp3Url: `/api/audio/file/${path.basename(mp3Path)}`
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: '转换失败，可能不是 AMR 格式或 ffmpeg 未安装'
      });
    }
  } catch (error) {
    console.error('[Audio] 转换失败:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    });
  }
});

export = router;
// Make this a module
export {};
