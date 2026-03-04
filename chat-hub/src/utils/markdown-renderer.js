/**
 * Markdown渲染器 - 增强版
 */

class MarkdownRenderer {
  constructor() {
    // 在Node.js环境中动态导入markdown-it
    this.md = null;
    this.hasInitialized = false;
  }

  /**
   * 初始化markdown-it
   */
  async initialize() {
    if (this.hasInitialized) {
      return this.md;
    }

    try {
      // 动态导入markdown-it
      const mdIt = (await import('markdown-it')).default;
      const mdItEmoji = (await import('markdown-it-emoji')).default;
      const mdItHighlight = (await import('highlight.js')).default;
      
      // 初始化markdown-it实例
      this.md = mdIt({
        html: true,
        linkify: true,
        typographer: true,
        breaks: true,
        highlight: function (str, lang) {
          if (lang && mdItHighlight.getLanguage(lang)) {
            try {
              return mdItHighlight.highlight(str, { language: lang }).value;
            } catch (__) {}
          }
          
          try {
            // 如果没有指定语言，尝试自动检测
            return mdItHighlight.highlightAuto(str).value;
          } catch (__) {}
          
          // 如果高亮失败，转义HTML
          return '';
        }
      })
      .use(mdItEmoji);
      
      this.hasInitialized = true;
      console.log('✅ Markdown渲染器初始化成功');
      return this.md;
    } catch (error) {
      console.error('❌ Markdown渲染器初始化失败:', error.message);
      // 创建一个基础的markdown-it实例
      const mdIt = (await import('markdown-it')).default;
      this.md = mdIt();
      this.hasInitialized = true;
      console.warn('⚠️  Markdown渲染器使用基础模式');
      return this.md;
    }
  }

  /**
   * 渲染markdown文本
   */
  async render(markdownText) {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    
    if (!markdownText || typeof markdownText !== 'string') {
      return '';
    }
    
    try {
      // 渲染markdown
      let html = this.md.render(markdownText);
      
      // 添加安全处理，防止XSS攻击
      html = this.sanitizeHtml(html);
      
      return html;
    } catch (error) {
      console.error('❌ Markdown渲染错误:', error.message);
      // 如果渲染失败，返回转义的原始文本
      return this.escapeHtml(markdownText);
    }
  }

  /**
   * 渲染行内markdown
   */
  async renderInline(markdownText) {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    
    if (!markdownText || typeof markdownText !== 'string') {
      return '';
    }
    
    try {
      return this.md.renderInline(markdownText);
    } catch (error) {
      console.error('❌ 行内Markdown渲染错误:', error.message);
      return this.escapeHtml(markdownText);
    }
  }

  /**
   * HTML安全过滤
   */
  sanitizeHtml(html) {
    // 移除潜在危险的标签和属性
    return html
      // 移除script标签
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // 移除on*事件处理器
      .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/on\w+\s*=\s*'[^']*'/gi, '')
      .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
      // 移除javascript:链接
      .replace(/href\s*=\s*"javascript:/gi, 'href="#"')
      .replace(/href\s*=\s*'javascript:/gi, "href='#'")
      .replace(/href\s*=\s*javascript:/gi, 'href="#"');
  }

  /**
   * HTML转义
   */
  escapeHtml(text) {
    if (typeof text !== 'string') {
      return '';
    }
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 解析消息中的特殊内容（如@提及、链接等）
   */
  async parseSpecialContent(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    // 解析@提及
    text = text.replace(/@[\w\u4e00-\u9fa5-]+/g, '<span class="mention">$&</span>');

    // 解析URL链接
    text = text.replace(
      /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    return text;
  }

  /**
   * 渲染带特殊内容的markdown
   */
  async renderWithSpecialContent(markdownText) {
    if (!this.hasInitialized) {
      await this.initialize();
    }

    if (!markdownText || typeof markdownText !== 'string') {
      return '';
    }

    // 首先处理特殊内容（如@提及）
    let processedText = await this.parseSpecialContent(markdownText);

    // 然后渲染markdown
    return await this.render(processedText);
  }
}

// 导出类
module.exports = MarkdownRenderer;

// 测试函数
async function testMarkdownRenderer() {
  console.log('🧪 测试Markdown渲染器...');
  
  const renderer = new MarkdownRenderer();
  
  // 测试基本markdown
  const testMd = `# 标题
这是**粗体**和*斜体*文本。

- 列表项1
- 列表项2

\`\`\`javascript
console.log('Hello World');
\`\`\`

[@小琳](https://example.com) 你好！`;

  try {
    const result = await renderer.renderWithSpecialContent(testMd);
    console.log('✅ Markdown渲染成功');
    console.log('输出示例:', result.substring(0, 200) + '...');
  } catch (error) {
    console.error('❌ Markdown渲染失败:', error);
  }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  testMarkdownRenderer().catch(console.error);
}

module.exports = MarkdownRenderer;