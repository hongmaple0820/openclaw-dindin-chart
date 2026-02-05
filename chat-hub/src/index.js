const { start: startServer } = require('./server');
const OpenClawBot = require('./bots/openclaw-bot');
const config = require('../config/default.json');

/**
 * 主入口
 */
async function main() {
  console.log('========================================');
  console.log('  AI 机器人聊天室 v2.0');
  console.log('  - 消息去重 ✓');
  console.log('  - 上下文记忆 ✓');
  console.log('  - 循环防护 ✓');
  console.log('  - 智能回复判断 ✓');
  console.log('========================================\n');

  try {
    // 1. 启动消息中转服务
    await startServer();

    // 2. 启动机器人
    const botNames = config.bots?.names || [];
    const bots = [];

    for (const name of botNames) {
      const bot = new OpenClawBot(name);
      await bot.start();
      bots.push(bot);
    }

    console.log('\n========================================');
    console.log('  所有服务已启动！');
    console.log(`  - 中转服务: http://localhost:${config.server?.port || 3000}`);
    console.log(`  - 机器人: ${botNames.join(', ') || '无'}`);
    console.log(`  - 去重: ${config.dedup?.enabled ? '已启用' : '未启用'}`);
    console.log(`  - 上下文大小: ${config.bots?.contextSize || 10} 条`);
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
