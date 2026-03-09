/**
 * OpenClaw Agent 接入示例
 * 
 * 本示例展示如何让 OpenClaw Agent 接入枫琳 AI 聊天室
 * 
 * 使用场景：
 * - OpenClaw 作为主 Agent 运行
 * - 需要读取 Skills 文件了解系统
 * - 通过 API 发送消息到群聊
 * - 订阅消息实现实时响应
 */

// ============================================
// OpenClaw AGENTS.md 配置示例
// ============================================

/**
 * 在 OpenClaw 的 AGENTS.md 中添加以下配置：
 * 
 * ```markdown
 * ## 📡 枫琳 AI 聊天室集成
 * 
 * ### 系统信息
 * - API 基地址: http://localhost:8273
 * - 运行模式: storage (存储分析模式)
 * - 支持平台: 钉钉群聊、Web 界面、私聊
 * 
 * ### 核心功能
 * 
 * #### 1. 发送消息到群聊
 * \`\`\`bash
 * curl -X POST http://localhost:8273/api/v1/messages/reply \
 *   -H "Content-Type: application/json" \
 *   -d '{"content": "消息内容", "sender": "小琳"}'
 * \`\`\`
 * 
 * #### 2. 发送私聊消息
 * \`\`\`bash
 * curl -X POST http://localhost:8273/api/v1/dm/send \
 *   -H "Content-Type: application/json" \
 *   -d '{"senderId": "小琳", "receiverId": "maple", "content": "私聊内容"}'
 * \`\`\`
 * 
 * #### 3. 搜索消息
 * \`\`\`bash
 * curl "http://localhost:8273/api/v1/messages/search?q=关键词"
 * \`\`\`
 * 
 * ### 行为规则
 * 
 * 1. 收到群聊消息时，检查是否需要回复
 * 2. 被 @ 或提及时，主动响应
 * 3. 可以发送主动消息（如提醒、通知）
 * 4. 保持消息频率在合理范围内（每分钟不超过 20 条）
 * ```
 */

// ============================================
// OpenClaw Skill 配置
// ============================================

/**
 * 创建 Skills 文件: ~/.openclaw/workspace/skills/fenlin-chat/SKILL.md
 * 
 * 内容如下：
 */

const OPENCLAW_SKILL_MD = `
---
name: fenlin-chat
description: |
  枫琳 AI 聊天室集成技能。用于发送消息到钉钉群聊和私聊。
  
  触发场景：
  - 需要发送群聊消息
  - 需要发送私聊消息
  - 需要搜索历史消息
  - 需要查看聊天统计
version: "1.0.0"
---

# 枫琳 AI 聊天室集成

## 快速开始

### 发送群聊消息

\`\`\`bash
curl -X POST http://localhost:8273/api/v1/messages/reply \\
  -H "Content-Type: application/json" \\
  -d '{"content": "你的消息", "sender": "小琳"}'
\`\`\`

### 发送私聊消息

\`\`\`bash
curl -X POST http://localhost:8273/api/v1/dm/send \\
  -H "Content-Type: application/json" \\
  -d '{"senderId": "小琳", "receiverId": "maple", "content": "私聊内容"}'
\`\`\`

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/v1/messages/reply | POST | 发送群聊消息 |
| /api/v1/dm/send | POST | 发送私聊消息 |
| /api/v1/messages | GET | 获取消息历史 |
| /api/v1/messages/search | GET | 搜索消息 |
| /api/stats | GET | 获取统计信息 |

## 使用示例

### 群聊消息
用户问: "帮我发送消息到群里说今天天气不错"
执行:
\`\`\`bash
curl -X POST http://localhost:8273/api/v1/messages/reply \\
  -H "Content-Type: application/json" \\
  -d '{"content": "今天天气不错 ☀️", "sender": "小琳"}'
\`\`\`

### 私聊消息
用户问: "私聊 maple 问一下项目进度"
执行:
\`\`\`bash
curl -X POST http://localhost:8273/api/v1/dm/send \\
  -H "Content-Type: application/json" \\
  -d '{"senderId": "小琳", "receiverId": "maple", "content": "请问项目进度如何？"}'
\`\`\`

## 注意事项

1. 确保 chat-hub 服务运行正常 (端口 8273)
2. 消息内容支持 Markdown 格式
3. 保持消息频率合理，避免刷屏
`;

// ============================================
// OpenClaw 集成代码
// ============================================

/**
 * OpenClaw 主动消息发送示例
 * 
 * 在 OpenClaw 中，可以通过以下方式发送消息：
 */

// 方式 1: 使用 curl 命令
async function sendMessageViaCurl(content: string, sender: string = '小琳') {
  const { execSync } = require('child_process');
  
  const command = `curl -s -X POST http://localhost:8273/api/v1/messages/reply \
    -H "Content-Type: application/json" \
    -d '{"content": "${content}", "sender": "${sender}"}'`;
  
  try {
    const result = execSync(command, { encoding: 'utf-8' });
    return JSON.parse(result);
  } catch (error) {
    console.error('发送消息失败:', error);
    throw error;
  }
}

// 方式 2: 使用 fetch API
async function sendMessageViaFetch(content: string, sender: string = '小琳') {
  const response = await fetch('http://localhost:8273/api/v1/messages/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, sender })
  });
  
  return response.json();
}

// 方式 3: 发送私聊消息
async function sendPrivateMessage(receiverId: string, content: string, senderId: string = '小琳') {
  const response = await fetch('http://localhost:8273/api/v1/dm/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      senderId,
      receiverId,
      content
    })
  });
  
  return response.json();
}

// ============================================
// OpenClaw 消息订阅示例
// ============================================

/**
 * 通过 SSE 订阅消息
 * 
 * 在 OpenClaw 中，可以在心跳检查时订阅消息：
 */

const HEARTBEAT_CONFIG = `
# HEARTBEAT.md - 心跳检查配置

## 消息订阅

定期检查是否有新消息需要处理：

\`\`\`bash
# 获取最近消息
curl -s "http://localhost:8273/api/v1/messages?limit=5"
\`\`\`

## 主动行为

可以执行的主动行为：

1. **定时提醒**: 每天早上 9 点发送天气提醒
2. **会议通知**: 检测到有会议时提前通知
3. **数据报告**: 定期发送群活跃度报告
`;

// ============================================
// 完整示例：OpenClaw Agent 类
// ============================================

class OpenClawAgent {
  private baseUrl: string = 'http://localhost:8273';
  private name: string;
  
  constructor(name: string = '小琳') {
    this.name = name;
  }
  
  /**
   * 发送群聊消息
   */
  async say(content: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/v1/messages/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        sender: this.name
      })
    });
    console.log(`[${this.name}] 发送消息: ${content}`);
  }
  
  /**
   * 发送私聊消息
   */
  async whisper(userId: string, content: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/v1/dm/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: this.name,
        receiverId: userId,
        content
      })
    });
    console.log(`[${this.name}] 私聊 ${userId}: ${content}`);
  }
  
  /**
   * 搜索消息
   */
  async search(keyword: string): Promise<any[]> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/messages/search?q=${encodeURIComponent(keyword)}`
    );
    const result = await response.json();
    return result.data || [];
  }
  
  /**
   * 获取统计信息
   */
  async getStats(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/stats`);
    return response.json();
  }
}

// ============================================
// 使用示例
// ============================================

async function main() {
  const agent = new OpenClawAgent('小琳');
  
  // 发送群聊消息
  await agent.say('大家好！我是小琳 👋');
  
  // 发送私聊消息
  await agent.whisper('maple', '你好，有个问题想问你...');
  
  // 搜索消息
  const messages = await agent.search('天气');
  console.log('搜索结果:', messages);
  
  // 获取统计
  const stats = await agent.getStats();
  console.log('统计信息:', stats);
}

// 导出
export { OpenClawAgent, sendMessageViaCurl, sendMessageViaFetch, sendPrivateMessage };
export { OPENCLAW_SKILL_MD, HEARTBEAT_CONFIG };