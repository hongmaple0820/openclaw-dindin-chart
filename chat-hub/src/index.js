const { start: startServer } = require('./server');
const OpenClawTrigger = require('./bots/openclaw-trigger');
const config = require('./config');

/**
 * 主入口
 */
async function main() {
  const botName = config.bot?.name || 'Bot';
  const mode = config.mode || 'storage';
  const triggerEnabled = config.trigger?.enabled ?? false;

  console.log('========================================');
  console.log(`  chat-hub 消息中转系统`);
  console.log('----------------------------------------');
  console.log(`  机器人: ${botName}`);
  console.log(`  模式: ${mode === 'hub' ? 'B - 完整中转' : 'A - 存储分析'}`);
  console.log('----------------------------------------');
  console.log('  功能状态:');
  console.log(`  - 消息存储: ${config.features?.storage !== false ? '✓' : '✗'}`);
  console.log(`  - 数据分析: ${config.features?.analytics !== false ? '✓' : '✗'}`);
  console.log(`  - Redis 同步: ${config.features?.redis !== false && config.redis?.enabled !== false ? '✓' : '✗'}`);
  console.log(`  - OpenClaw 触发: ${triggerEnabled ? '✓' : '✗'}`);
  console.log(`  - 钉钉 Webhook: ${config.dingtalk?.enabled !== false && config.dingtalk?.webhookBase ? '✓' : '✗'}`);
  console.log('========================================\n');

  try {
    // 1. 启动消息中转服务
    await startServer();

    // 2. 根据配置决定是否启动 OpenClaw 触发器
    if (triggerEnabled) {
      const trigger = new OpenClawTrigger(botName, {
        gatewayUrl: config.bot?.gatewayUrl || null,
        gatewayToken: config.bot?.gatewayToken || null,
        cooldownMs: config.trigger?.cooldownMs || 3000,
        command: config.trigger?.command || 'openclaw system event --text',
        messagePrefix: config.trigger?.messagePrefix || '[钉钉群消息]'
      });
      await trigger.start();
      console.log('[Trigger] OpenClaw 触发器已启动');
    } else {
      console.log('[Trigger] OpenClaw 触发器未启用（模式 A：存储分析）');
    }

    console.log('\n========================================');
    console.log('  服务已启动！');
    console.log(`  API: http://localhost:${config.server?.port || 3000}`);
    if (config.redis?.host) {
      console.log(`  Redis: ${config.redis.host}:${config.redis.port || 6379}`);
    }
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
