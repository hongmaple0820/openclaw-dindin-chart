/**
 * Bot 管理器
 * 支持多 Bot 独立 webhook 配置和智能路由
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');

const dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'users.db');
const db = new Database(dbPath);

const MIN_SEND_INTERVAL = 1000;
const RATE_LIMIT = {
  maxPerMinute: 20,
  window: 60000,
  records: {}
};

function generateSign(secret, timestamp) {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(stringToSign);
  return encodeURIComponent(hmac.digest('base64'));
}

function checkRateLimit(botId) {
  const now = Date.now();
  if (!RATE_LIMIT.records[botId]) {
    RATE_LIMIT.records[botId] = [];
  }
  RATE_LIMIT.records[botId] = RATE_LIMIT.records[botId].filter(
    time => now - time < RATE_LIMIT.window
  );
  if (RATE_LIMIT.records[botId].length >= RATE_LIMIT.maxPerMinute) {
    const oldestRecord = RATE_LIMIT.records[botId][0];
    const waitTime = RATE_LIMIT.window - (now - oldestRecord);
    throw new Error(`频率限制：已达到每分钟 ${RATE_LIMIT.maxPerMinute} 条上限，请等待 ${Math.ceil(waitTime / 1000)}s`);
  }
  RATE_LIMIT.records[botId].push(now);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  retryDelayMultiplier: 2
};

async function requestWithRetry(url, data, retries = 0) {
  try {
    const response = await axios.post(url, data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    if (response.data.errcode !== 0 && response.data.errcode !== undefined) {
      throw new Error(`钉钉 API 错误: ${response.data.errmsg || '未知错误'}`);
    }
    return response;
  } catch (error: any) {
    if (retries < RETRY_CONFIG.maxRetries) {
      const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.retryDelayMultiplier, retries);
      await sleep(delay);
      return requestWithRetry(url, data, retries + 1);
    }
    throw error;
  }
}

let sendQueue = Promise.resolve();

function queuedSend(fn) {
  sendQueue = sendQueue.then(async () => {
    const now = Date.now();
    if (now - lastSendTime < MIN_SEND_INTERVAL) {
      await sleep(MIN_SEND_INTERVAL - (now - lastSendTime));
    }
    lastSendTime = Date.now();
    return fn();
  });
  return sendQueue;
}

let lastSendTime = 0;

class BotManager {
  
  createBot(data) {
    const id = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const now = Date.now();
    
    if (data.isDefault) {
      db.prepare('UPDATE users SET is_default = 0 WHERE type = ?').run('bot');
    }
    
    const stmt = db.prepare(`
      INSERT INTO users (id, username, nickname, type, status, webhook_base, webhook_secret, webhook_token, webhook_enabled, is_default, reply_enabled, created_at)
      VALUES (?, ?, ?, 'bot', 'approved', ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.username,
      data.displayName || data.username,
      data.webhookBase || '',
      data.webhookSecret || '',
      data.webhookToken || '',
      data.webhookEnabled !== false ? 1 : 0,
      data.isDefault ? 1 : 0,
      data.replyEnabled !== false ? 1 : 0,
      now
    );
    
    console.log(`[BotManager] 创建 Bot: ${data.username}`);
    return this.getBot(id);
  }
  
  updateBot(id, data) {
    const bot = this.getBot(id);
    if (!bot) {
      throw new Error('Bot 不存在');
    }
    
    if (data.isDefault) {
      db.prepare('UPDATE users SET is_default = 0 WHERE type = ?').run('bot');
    }
    
    const fields = [];
    const values = [];
    
    if (data.username !== undefined) { fields.push('username = ?'); values.push(data.username); }
    if (data.displayName !== undefined) { fields.push('nickname = ?'); values.push(data.displayName); }
    if (data.webhookBase !== undefined) { fields.push('webhook_base = ?'); values.push(data.webhookBase); }
    if (data.webhookSecret !== undefined) { fields.push('webhook_secret = ?'); values.push(data.webhookSecret); }
    if (data.webhookToken !== undefined) { fields.push('webhook_token = ?'); values.push(data.webhookToken); }
    if (data.webhookEnabled !== undefined) { fields.push('webhook_enabled = ?'); values.push(data.webhookEnabled ? 1 : 0); }
    if (data.isDefault !== undefined) { fields.push('is_default = ?'); values.push(data.isDefault ? 1 : 0); }
    if (data.replyEnabled !== undefined) { fields.push('reply_enabled = ?'); values.push(data.replyEnabled ? 1 : 0); }
    
    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);
    
    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    
    console.log(`[BotManager] 更新 Bot: ${id}`);
    return this.getBot(id);
  }
  
  deleteBot(id) {
    const bot = this.getBot(id);
    if (!bot) {
      throw new Error('Bot 不存在');
    }
    
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    console.log(`[BotManager] 删除 Bot: ${id}`);
    return true;
  }
  
  getBot(id) {
    const row = db.prepare('SELECT * FROM users WHERE id = ? AND type = ?').get(id, 'bot');
    if (!row) return null;
    return this.mapBot(row);
  }
  
  getBotByUsername(username) {
    const row = db.prepare('SELECT * FROM users WHERE username = ? AND type = ?').get(username, 'bot');
    if (!row) return null;
    return this.mapBot(row);
  }
  
  listBots(filters = {}) {
    let sql = 'SELECT * FROM users WHERE type = ?';
    const params = ['bot'];
    
    if (filters.enabled !== undefined) {
      sql += ' AND webhook_enabled = ?';
      params.push(filters.enabled ? 1 : 0);
    }
    
    sql += ' ORDER BY is_default DESC, created_at DESC';
    
    const rows = db.prepare(sql).all(...params);
    return rows.map(row => this.mapBot(row));
  }
  
  getDefaultBot() {
    const row = db.prepare('SELECT * FROM users WHERE type = ? AND is_default = 1').get('bot');
    if (!row) {
      const first = db.prepare('SELECT * FROM users WHERE type = ? AND webhook_enabled = 1').get('bot');
      return first ? this.mapBot(first) : null;
    }
    return this.mapBot(row);
  }
  
  mapBot(row) {
    return {
      id: row.id,
      username: row.username,
      displayName: row.nickname,
      type: row.type,
      webhookBase: row.webhook_base,
      webhookSecret: row.webhook_secret,
      webhookToken: row.webhook_token,
      webhookEnabled: row.webhook_enabled === 1,
      isDefault: row.is_default === 1,
      replyEnabled: row.reply_enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  
  resolveBot(message, context = {}) {
    const content = message.content || '';
    
    const atMatch = content.match(/@(\S+)/);
    if (atMatch) {
      const name = atMatch[1];
      const bot = this.getBotByUsername(name);
      if (bot && bot.webhookEnabled) {
        return { bot, reason: `@匹配: @${name}`, confidence: 1.0 };
      }
    }
    
    const allBots = this.listBots({ enabled: true });
    for (const bot of allBots) {
      if (content.includes(bot.username) || content.includes(bot.displayName)) {
        return { bot, reason: `名字提及: ${bot.displayName}`, confidence: 0.8 };
      }
    }
    
    if (context.lastBotId) {
      const lastBot = this.getBot(context.lastBotId);
      if (lastBot && lastBot.replyEnabled && this.isContinuation(content)) {
        return { bot: lastBot, reason: '上下文延续', confidence: 0.6 };
      }
    }
    
    const defaultBot = this.getDefaultBot();
    if (defaultBot && defaultBot.replyEnabled) {
      return { bot: defaultBot, reason: '默认', confidence: 0.5 };
    }
    
    return null;
  }
  
  isContinuation(content) {
    return /^(对|是的|好的|继续|然后|还有)/.test(content) || 
           /[?？!！]$/.test(content) ||
           /问一下|请问|帮忙/.test(content);
  }
  
  async sendToBot(botId, content, sender = 'System', atTargets = null) {
    const bot = this.getBot(botId);
    if (!bot) {
      throw new Error('Bot 不存在');
    }
    if (!bot.webhookEnabled) {
      throw new Error('Bot webhook 未启用');
    }
    if (!bot.webhookBase) {
      throw new Error('Bot webhook 未配置');
    }
    
    return await this.send(bot, content, sender, atTargets);
  }
  
  async send(bot, content, sender = 'System', atTargets = null) {
    return queuedSend(async () => {
      checkRateLimit(bot.id);
      
      const timestamp = Date.now();
      let url = bot.webhookBase;
      
      if (bot.webhookSecret) {
        const sign = generateSign(bot.webhookSecret, timestamp);
        url = `${bot.webhookBase}&timestamp=${timestamp}&sign=${sign}`;
      } else if (bot.webhookToken) {
        const separator = bot.webhookBase.includes('?') ? '&' : '?';
        url = `${bot.webhookBase}${separator}access_token=${bot.webhookToken}`;
      }
      
      const { atMobiles, isAtAll, atText } = this.parseAtTargets(atTargets);
      const fullContent = sender ? `${atText}${content} [${sender}]` : `${atText}${content}`;
      
      const data = {
        msgtype: 'text',
        text: { content: fullContent },
        at: { atMobiles, isAtAll }
      };
      
      console.log(`[BotManager] 发送消息到 ${bot.displayName}:`, content.substring(0, 50));
      
      try {
        const response = await requestWithRetry(url, data);
        console.log(`[BotManager] 发送成功: ${bot.displayName}`);
        return response.data;
      } catch (error: any) {
        console.error(`[BotManager] 发送失败: ${error.message}`);
        throw error;
      }
    });
  }
  
  parseAtTargets(atTargets) {
    const atMobiles = [];
    let isAtAll = false;
    let atText = '';
    
    if (!atTargets) return { atMobiles, isAtAll, atText };
    
    const targets = Array.isArray(atTargets) ? atTargets : [atTargets];
    
    for (const target of targets) {
      if (target === 'all' || target === '所有人') {
        isAtAll = true;
        atText = '@所有人 ';
      } else {
        atText += `@${target} `;
      }
    }
    
    return { atMobiles, isAtAll, atText };
  }
  
  async testBot(botId) {
    const bot = this.getBot(botId);
    if (!bot) {
      throw new Error('Bot 不存在');
    }
    if (!bot.webhookBase) {
      throw new Error('Webhook 未配置');
    }
    
    return await this.send(bot, '测试消息 - Chat-Hub Bot 管理器', 'System', null);
  }
}

const botManager = new BotManager();

module.exports = botManager;

export {};
