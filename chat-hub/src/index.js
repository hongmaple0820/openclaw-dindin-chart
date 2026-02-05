const { start: startServer } = require('./server');
const OpenClawTrigger = require('./bots/openclaw-trigger');
const config = require('../config/default.json');

/**
 * 主入口
 */
async function main() {
  const botName = config.bot?.name || '小琳';
  
  console.log('========================================');
  console.log(`  AI 聊天室 - ${botName}`);
  console.log('  - Redis 消息总线 ✓');
  console.log('  - 消息去重 ✓');
  console.log('  - OpenClaw 触发器 ✓');
  console.log('  - 钉钉 Webhook ✓');
  console.log('========================================\n');

  try {
    // 1. 启动消息中转服务
    await startServer();

    // 2. 启动 OpenClaw 触发器（只处理自己）
    const trigger = new OpenClawTrigger(botName, {
      gatewayUrl: config.bot?.gatewayUrl || null,
      gatewayToken: config.bot?.gatewayToken || null,
      cooldownMs: config.bots?.cooldownMs || 3000
    });
    await trigger.start();

    console.log('\n========================================');
    console.log('  服务已启动！');
    console.log(`  - 机器人: ${botName}`);
    console.log(`  - 中转服务: http://localhost:${config.server?.port || 3000}`);
    console.log(`  - Redis: ${config.redis?.host}:${config.redis?.port}`);
    console.log(`  - 去重: ${config.dedup?.enabled ? '已启用' : '未启用'}`);
    console.log('========================================\n');

    // 优雅退出
    process.on('SIGINT', async () => {
      console.log('\n正在关闭服务...');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n收到终止信号，关闭服务...');
      process.exit(0);
    });

  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

main();
