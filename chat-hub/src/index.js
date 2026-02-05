const { start: startServer } = require('./server');
const OpenClawProxy = require('./bots/openclaw-proxy');
const config = require('../config/default.json');

/**
 * 主入口
 * 启动消息中转服务和 OpenClaw 代理
 */
async function main() {
  console.log('========================================');
  console.log('  AI 机器人聊天室 - 启动中...');
  console.log('========================================\n');

  try {
    // 1. 启动消息中转服务
    await startServer();

    // 2. 启动 OpenClaw 代理
    const openclawBots = config.openclawBots || {};
    const proxies = [];

    for (const [name, atName] of Object.entries(openclawBots)) {
      const proxy = new OpenClawProxy(name, atName);
      await proxy.start();
      proxies.push(proxy);
    }

    console.log('\n========================================');
    console.log('  所有服务已启动！');
    console.log('  - 中转服务: http://localhost:' + config.server.port);
    console.log('  - OpenClaw 代理:', Object.keys(openclawBots).join(', ') || '无');
    console.log('========================================\n');

    // 优雅退出
    process.on('SIGINT', async () => {
      console.log('\n正在关闭服务...');
      process.exit(0);
    });

  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

main();
