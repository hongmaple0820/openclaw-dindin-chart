/**
 * 插件创建服务
 * 支持用户自定义创建和导入插件
 * 
 * 参考设计：
 * - OpenAI Plugins: manifest + API spec
 * - LangChain Tools: structured input/output
 * - 飞书/企业微信: 事件驱动 + API 封装
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class PluginCreator {
  constructor(pluginManager, skillsDir) {
    this.pluginManager = pluginManager;
    this.skillsDir = skillsDir || path.join(__dirname, '../../chat-hub-config/skills');
    this.templates = this._loadTemplates();
  }

  _loadTemplates() {
    return {
      channel: {
        name: '通道插件模板',
        description: '用于消息通道（钉钉、企业微信、飞书、Telegram等）',
        files: {
          'skill.yaml': `name: {{name}}
version: 1.0.0
category: channel
description: {{description}}

capabilities:
  - send_message
  - receive_message

config:
  api_url:
    type: string
    required: true
    description: API 地址
  token:
    type: password
    required: true
    description: 访问令牌
`,
          'index.js': `const ChannelPlugin = require('../../src/plugins/channel-plugin');

class {{className}} extends ChannelPlugin {
  constructor(config) {
    super(config);
    this.name = '{{name}}';
  }

  async init() {
    console.log('[{{className}}] 初始化...');
    return { success: true };
  }

  async sendMessage(to, content, options = {}) {
    return { success: true, messageId: 'msg_' + Date.now() };
  }

  async parseWebhook(body) {
    return { success: true, messages: [] };
  }

  async testConnection() {
    return { success: true, message: '连接成功' };
  }
}

module.exports = {{className}};
`
        }
      },
      service: {
        name: '服务插件模板',
        description: '用于提供服务（图片生成、语音合成、翻译等）',
        files: {
          'skill.yaml': `name: {{name}}
version: 1.0.0
category: service
description: {{description}}

capabilities:
  - process

config:
  api_key:
    type: password
    required: true
    description: API 密钥
`,
          'index.js': `const BasePlugin = require('../../src/plugins/base-plugin');

class {{className}} extends BasePlugin {
  constructor(config) {
    super(config);
    this.name = '{{name}}';
    this.type = 'service';
  }

  async init() {
    return { success: true };
  }

  async execute(action, params) {
    return { success: true, result: null };
  }
}

module.exports = {{className}};
`
        }
      },
      tool: {
        name: '工具插件模板',
        description: '用于提供工具（代码执行、搜索、数据库查询等）',
        files: {
          'skill.yaml': `name: {{name}}
version: 1.0.0
category: tool
description: {{description}}

capabilities:
  - execute

config:
  timeout:
    type: number
    default: 30000
`,
          'index.js': `const BasePlugin = require('../../src/plugins/base-plugin');

class {{className}} extends BasePlugin {
  constructor(config) {
    super(config);
    this.name = '{{name}}';
    this.type = 'tool';
  }

  async init() {
    return { success: true };
  }

  async execute(action, params) {
    return { success: true, result: null };
  }
}

module.exports = {{className}};
`
        }
      }
    };
  }

  getTemplates() {
    return Object.entries(this.templates).map(([key, t]) => ({
      id: key,
      name: t.name,
      description: t.description
    }));
  }

  async create(options) {
    const { id, name, description, template = 'service' } = options;

    if (!id || !/^[a-z0-9-]+$/.test(id)) {
      return { success: false, error: '插件 ID 只能包含小写字母、数字和连字符' };
    }

    const pluginDir = path.join(this.skillsDir, id);
    if (fs.existsSync(pluginDir)) {
      return { success: false, error: '插件已存在: ' + id };
    }

    const templateData = this.templates[template];
    if (!templateData) {
      return { success: false, error: '未知模板: ' + template };
    }

    fs.mkdirSync(pluginDir, { recursive: true });

    const className = this._toClassName(id);
    const replacements = {
      '{{name}}': name || id,
      '{{description}}': description || '',
      '{{className}}': className
    };

    for (const [filename, content] of Object.entries(templateData.files)) {
      let finalContent = content;
      for (const [key, value] of Object.entries(replacements)) {
        finalContent = finalContent.split(key).join(value);
      }
      fs.writeFileSync(path.join(pluginDir, filename), finalContent);
    }

    const registerResult = await this.pluginManager.register(pluginDir, { id, name: name || id, description, type: template });

    return { success: true, pluginId: id, path: pluginDir, registered: registerResult.success };
  }

  async importFromZip(zipBuffer, options = {}) {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();
    
    const hasSkillYaml = zipEntries.some(e => e.entryName.endsWith('skill.yaml'));
    if (!hasSkillYaml) return { success: false, error: '缺少 skill.yaml 文件' };
    
    const tempDir = path.join(this.skillsDir, '.temp_' + uuidv4());
    zip.extractAllTo(tempDir, true);
    
    let skillDir = tempDir;
    for (const entry of zipEntries) {
      if (entry.entryName.endsWith('skill.yaml')) {
        skillDir = path.join(tempDir, path.dirname(entry.entryName));
        break;
      }
    }
    
    const yaml = require('js-yaml');
    const skillYaml = yaml.load(fs.readFileSync(path.join(skillDir, 'skill.yaml'), 'utf-8'));
    const pluginId = options.id || skillYaml.name || 'plugin_' + Date.now();
    
    const finalDir = path.join(this.skillsDir, pluginId);
    if (fs.existsSync(finalDir)) {
      fs.rmSync(tempDir, { recursive: true });
      return { success: false, error: '插件已存在: ' + pluginId };
    }
    
    fs.renameSync(skillDir, finalDir);
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
    
    await this.pluginManager.register(finalDir);
    return { success: true, pluginId, path: finalDir };
  }

  async importFromGit(gitUrl, options = {}) {
    const tempDir = path.join(this.skillsDir, '.temp_' + uuidv4());
    const { execSync } = require('child_process');
    execSync(\`git clone --depth 1 \${gitUrl} \${tempDir}\`, { stdio: 'pipe' });
    
    const findYaml = (dir) => {
      for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          const result = findYaml(fullPath);
          if (result) return result;
        } else if (file === 'skill.yaml') {
          return dir;
        }
      }
      return null;
    };
    
    const skillDir = findYaml(tempDir);
    if (!skillDir) {
      fs.rmSync(tempDir, { recursive: true });
      return { success: false, error: '未找到 skill.yaml 文件' };
    }
    
    const yaml = require('js-yaml');
    const skillYaml = yaml.load(fs.readFileSync(path.join(skillDir, 'skill.yaml'), 'utf-8'));
    const pluginId = options.id || skillYaml.name || path.basename(gitUrl, '.git');
    
    const finalDir = path.join(this.skillsDir, pluginId);
    if (fs.existsSync(finalDir)) {
      fs.rmSync(tempDir, { recursive: true });
      return { success: false, error: '插件已存在: ' + pluginId };
    }
    
    fs.renameSync(skillDir, finalDir);
    fs.rmSync(tempDir, { recursive: true });
    await this.pluginManager.register(finalDir);
    
    return { success: true, pluginId, path: finalDir };
  }

  getPluginCode(pluginId) {
    const pluginDir = path.join(this.skillsDir, pluginId);
    if (!fs.existsSync(pluginDir)) return null;
    
    const files = {};
    for (const filename of ['index.js', 'plugin.js', 'skill.yaml', 'config.json']) {
      const filePath = path.join(pluginDir, filename);
      if (fs.existsSync(filePath)) {
        files[filename] = fs.readFileSync(filePath, 'utf-8');
      }
    }
    return files;
  }

  async updateCode(pluginId, filename, code) {
    const pluginDir = path.join(this.skillsDir, pluginId);
    if (!fs.existsSync(pluginDir)) return { success: false, error: '插件不存在' };
    
    const allowedFiles = ['index.js', 'plugin.js', 'skill.yaml', 'config.json'];
    if (!allowedFiles.includes(filename)) return { success: false, error: '不允许修改此文件' };
    
    fs.writeFileSync(path.join(pluginDir, filename), code);
    await this.pluginManager.togglePlugin(pluginId, false);
    await this.pluginManager.togglePlugin(pluginId, true);
    
    return { success: true };
  }

  async delete(pluginId) {
    const pluginDir = path.join(this.skillsDir, pluginId);
    if (!fs.existsSync(pluginDir)) return { success: false, error: '插件不存在' };
    
    await this.pluginManager.deletePlugin(pluginId);
    fs.rmSync(pluginDir, { recursive: true });
    return { success: true };
  }

  _toClassName(id) {
    return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Plugin';
  }
}

module.exports = PluginCreator;
.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Plugin';
  }
}

module.exports = PluginCreator;
