const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

/**
 * 消息导出服务
 */
class MessageExportService {
  constructor() {
    this.exportDir = path.join(process.env.HOME, '.openclaw', 'chat-data', 'exports');
    
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
      console.log('[Export] 创建导出目录:', this.exportDir);
    }
  }

  /**
   * 导出为 JSON
   */
  exportJSON(messages, options = {}) {
    const { includeImages = false, includeReactions = false } = options;
    
    const data = {
      exportedAt: new Date().toISOString(),
      count: messages.length,
      messages: messages.map(msg => ({
        ...msg,
        images: includeImages ? msg.images : undefined,
        reactions: includeReactions ? msg.reactions : undefined
      }))
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * 导出为 CSV
   */
  exportCSV(messages) {
    const headers = ['ID', 'Type', 'Sender', 'Content', 'Timestamp', 'Source'];
    const rows = messages.map(msg => [
      msg.id,
      msg.type,
      msg.sender,
      `"${msg.content.replace(/"/g, '""')}"`,  // CSV 转义
      new Date(msg.timestamp).toISOString(),
      msg.source || ''
    ]);
    
    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }

  /**
   * 导出为 Markdown
   */
  exportMarkdown(messages, options = {}) {
    const { title = '聊天记录', includeReactions = false } = options;
    
    let md = `# ${title}\n\n`;
    md += `> 导出时间：${new Date().toISOString()}\n`;
    md += `> 消息数量：${messages.length}\n\n`;
    md += '---\n\n';
    
    messages.forEach(msg => {
      md += `## ${msg.sender}\n\n`;
      md += `**时间**：${new Date(msg.timestamp).toLocaleString('zh-CN')}\n\n`;
      md += `${msg.content}\n\n`;
      
      if (includeReactions && msg.reactions && msg.reactions.length > 0) {
        md += `**表情回应**：\n`;
        msg.reactions.forEach(r => {
          md += `- ${r.emoji} ${r.count} (${r.reactors.join(', ')})\n`;
        });
        md += '\n';
      }
      
      if (msg.images && msg.images.length > 0) {
        md += `**图片**：${msg.images.length} 张\n\n`;
      }
      
      md += '---\n\n';
    });
    
    return md;
  }

  /**
   * 导出为 HTML
   */
  exportHTML(messages, options = {}) {
    const { title = '聊天记录', includeReactions = false } = options;
    
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .message {
      background: white;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .sender {
      font-weight: bold;
      color: #007AFF;
      margin-bottom: 5px;
    }
    .timestamp {
      font-size: 12px;
      color: #8E8E93;
      margin-bottom: 10px;
    }
    .content {
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .reactions {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #E5E5EA;
    }
    .reaction {
      display: inline-block;
      background: #F2F2F7;
      padding: 4px 8px;
      border-radius: 12px;
      margin-right: 8px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <p>导出时间：${new Date().toLocaleString('zh-CN')}</p>
    <p>消息数量：${messages.length}</p>
  </div>
`;
    
    messages.forEach(msg => {
      html += `  <div class="message">
    <div class="sender">${this.escapeHTML(msg.sender)}</div>
    <div class="timestamp">${new Date(msg.timestamp).toLocaleString('zh-CN')}</div>
    <div class="content">${this.escapeHTML(msg.content)}</div>
`;
      
      if (includeReactions && msg.reactions && msg.reactions.length > 0) {
        html += `    <div class="reactions">
`;
        msg.reactions.forEach(r => {
          html += `      <span class="reaction">${r.emoji} ${r.count}</span>
`;
        });
        html += `    </div>
`;
      }
      
      html += `  </div>
`;
    });
    
    html += `</body>
</html>`;
    
    return html;
  }

  /**
   * HTML 转义
   */
  escapeHTML(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 创建 ZIP 压缩包
   */
  async createZip(files, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      output.on('close', () => {
        console.log('[Export] ZIP 创建完成:', archive.pointer(), 'bytes');
        resolve(outputPath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // 添加文件
      files.forEach(file => {
        if (typeof file.content === 'string') {
          archive.append(file.content, { name: file.name });
        } else if (file.path) {
          archive.file(file.path, { name: file.name });
        }
      });

      archive.finalize();
    });
  }

  /**
   * 清理过期的导出文件（7天前）
   */
  cleanupOldExports() {
    try {
      const files = fs.readdirSync(this.exportDir);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000;  // 7天

      files.forEach(file => {
        const filePath = path.join(this.exportDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          console.log('[Export] 已删除过期文件:', file);
        }
      });
    } catch (error) {
      console.error('[Export] 清理失败:', error.message);
    }
  }
}

module.exports = new MessageExportService();
