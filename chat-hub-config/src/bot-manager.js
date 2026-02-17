const http = require('http');
const path = require('path');

const CHAT_HUB_PATH = path.join(__dirname, '../../chat-hub');
const API_BASE = 'http://localhost:3000';

async function callApi(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          resolve({ success: false, error: body });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runBotList(args) {
  const listMode = args.includes('--list') || args.length === 0;

  try {
    const result = await callApi('/api/v1/bots');

    if (!result.success) {
      console.log(`\n❌ 获取 Bot 列表失败: ${result.error}`);
      return;
    }

    const bots = result.bots || [];

    if (bots.length === 0) {
      console.log('\n📋 暂无 Bot，请使用 bot-add 添加');
      return;
    }

    console.log('\n📋 Bot 列表:');
    console.log('═'.repeat(60));

    for (const bot of bots) {
      const status = bot.webhookEnabled ? '✅' : '❌';
      const defaultTag = bot.isDefault ? ' [默认]' : '';
      console.log(`\n  ${status} ${bot.username}${defaultTag}`);
      console.log(`     ID: ${bot.id}`);
      console.log(`     显示名称: ${bot.displayName}`);
      console.log(`     Webhook: ${bot.webhookBase ? '已配置' : '未配置'}`);
      console.log(`     自动回复: ${bot.replyEnabled ? '启用' : '禁用'}`);
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`📊 共 ${bots.length} 个 Bot`);

  } catch (error) {
    console.log(`\n❌ 连接失败: ${error.message}`);
    console.log('   请确保 chat-hub 服务已启动');
  }
}

async function runBotAdd(args) {
  if (args.length < 2) {
    console.log('\n❌ 用法: openclaw skill chat-hub-config bot-add <name> <webhookUrl> [--secret <secret>] [--default]');
    console.log('\n示例:');
    console.log('  openclaw skill chat-hub-config bot-add 小琳 https://oapi.dingtalk.com/robot/send?access_token=xxx --secret SECxxx --default');
    return;
  }

  const name = args[0];
  const webhookUrl = args[1];
  let isDefault = false;
  let secret = '';

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--default') {
      isDefault = true;
    } else if (args[i] === '--secret' && args[i + 1]) {
      secret = args[i + 1];
      i++;
    }
  }

  try {
    console.log(`\n⏳ 正在创建 Bot: ${name}...`);

    const result = await callApi('/api/v1/bots', 'POST', {
      username: name,
      displayName: name,
      webhookBase: webhookUrl,
      webhookSecret: secret,
      isDefault: isDefault
    });

    if (result.success) {
      console.log(`\n✅ Bot 创建成功!`);
      console.log(`   名称: ${result.bot.username}`);
      console.log(`   ID: ${result.bot.id}`);
    } else {
      console.log(`\n❌ 创建失败: ${result.error}`);
    }

  } catch (error) {
    console.log(`\n❌ 请求失败: ${error.message}`);
  }
}

async function runBotUpdate(args) {
  if (args.length < 2) {
    console.log('\n❌ 用法: openclaw skill chat-hub-config bot-update <id> [--webhook <url>] [--secret <secret>] [--default]');
    return;
  }

  const botId = args[0];
  const updates = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--webhook' && args[i + 1]) {
      updates.webhookBase = args[i + 1];
      i++;
    } else if (args[i] === '--secret' && args[i + 1]) {
      updates.webhookSecret = args[i + 1];
      i++;
    } else if (args[i] === '--default') {
      updates.isDefault = true;
    }
  }

  try {
    console.log(`\n⏳ 正在更新 Bot...`);

    const result = await callApi(`/api/v1/bots/${botId}`, 'PUT', updates);

    if (result.success) {
      console.log(`\n✅ Bot 更新成功!`);
    } else {
      console.log(`\n❌ 更新失败: ${result.error}`);
    }

  } catch (error) {
    console.log(`\n❌ 请求失败: ${error.message}`);
  }
}

async function runBotDelete(args) {
  if (args.length < 1) {
    console.log('\n❌ 用法: openclaw skill chat-hub-config bot-delete <id>');
    return;
  }

  const botId = args[0];

  try {
    console.log(`\n⏳ 正在删除 Bot...`);

    const result = await callApi(`/api/v1/bots/${botId}`, 'DELETE');

    if (result.success) {
      console.log(`\n✅ Bot 已删除`);
    } else {
      console.log(`\n❌ 删除失败: ${result.error}`);
    }

  } catch (error) {
    console.log(`\n❌ 请求失败: ${error.message}`);
  }
}

async function runBotTest(args) {
  if (args.length < 1) {
    console.log('\n❌ 用法: openclaw skill chat-hub-config bot-test <id>');
    return;
  }

  const botId = args[0];

  try {
    console.log(`\n⏳ 正在测试 Bot webhook...`);

    const result = await callApi(`/api/v1/bots/${botId}/test`, 'POST');

    if (result.success) {
      console.log(`\n✅ 测试消息发送成功!`);
      console.log(`   响应: ${JSON.stringify(result.result)}`);
    } else {
      console.log(`\n❌ 测试失败: ${result.error}`);
    }

  } catch (error) {
    console.log(`\n❌ 请求失败: ${error.message}`);
  }
}

module.exports = {
  runBotList,
  runBotAdd,
  runBotUpdate,
  runBotDelete,
  runBotTest
};
