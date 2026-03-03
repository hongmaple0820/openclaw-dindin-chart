/**
 * 语音生成器
 * 使用 OpenClaw 内置 TTS
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class VoiceGenerator {
  constructor() {
    this.mediaRoot = process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw');
    this.voiceDir = path.join(this.mediaRoot, 'media', 'voice');
  }
  
  async ensureVoiceDir() {
    await fs.mkdir(this.voiceDir, { recursive: true });
  }
  
  /**
   * 生成语音文件
   * @param {string} text - 要转换的文本
   * @param {object} voiceConfig - 语音配置
   * @returns {Promise<{filePath: string, fileUrl: string, duration: number}>}
   */
  async generateVoice(text, voiceConfig = {}) {
    await this.ensureVoiceDir();
    
    const timestamp = Date.now();
    const filename = `voice_${timestamp}.mp3`;
    const filePath = path.join(this.voiceDir, filename);
    
    try {
      // 使用 OpenClaw 内置 TTS
      const command = `openclaw tts "${text.replace(/"/g, '\\"')}" --output "${filePath}"`;
      
      console.log('[VoiceGenerator] 生成语音:', text.substring(0, 50));
      
      // 设置超时 30 秒
      await execAsync(command, { timeout: 30000 });
      
      // 检查文件是否生成
      const stats = await fs.stat(filePath);
      
      // 估算时长（1秒约150字，或根据文件大小估算）
      const duration = Math.max(1, Math.ceil(text.length / 5)); // 粗略估算
      
      return {
        filePath,
        fileUrl: `http://localhost:8273/media/voice/${filename}`,
        duration,
        size: stats.size
      };
    } catch (error) {
      console.error('[VoiceGenerator] 生成失败:', error.message);
      
      // 如果 TTS 失败，返回 null（不阻塞主流程）
      return null;
    }
  }
  
  /**
   * 清理旧的语音文件（保留最近100个）
   */
  async cleanup() {
    try {
      const files = await fs.readdir(this.voiceDir);
      const voiceFiles = files
        .filter(f => f.startsWith('voice_') && f.endsWith('.mp3'))
        .map(f => ({
          name: f,
          path: path.join(this.voiceDir, f),
          time: parseInt(f.match(/voice_(\d+)\.mp3/)?.[1] || '0')
        }))
        .sort((a, b) => b.time - a.time);
      
      // 删除超过100个的旧文件
      if (voiceFiles.length > 100) {
        for (const file of voiceFiles.slice(100)) {
          await fs.unlink(file.path);
          console.log(`[VoiceGenerator] 清理旧文件: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('[VoiceGenerator] 清理失败:', error.message);
    }
  }
}

module.exports = new VoiceGenerator();
