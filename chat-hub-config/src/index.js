const { runCheck } = require('./checker');
const { runSetup } = require('./wizard');
const { runDiagnose } = require('./diagnoser');
const { runBackup, runRestore } = require('./backup');
const { runRepair } = require('./repair');
const { runStart, runStop, runRestart, runStatus, runLogs } = require('./runner');

const COMMANDS = {
  check: {
    description: '检查配置完整性和有效性',
    usage: 'openclaw skill chat-hub-config check [--verbose] [--fix] [--format json]',
    fn: runCheck
  },
  setup: {
    description: '交互式配置向导',
    usage: 'openclaw skill chat-hub-config setup [--force] [--step <step>]',
    fn: runSetup
  },
  diagnose: {
    description: '系统诊断并生成报告',
    usage: 'openclaw skill chat-hub-config diagnose [--full] [--report <path>]',
    fn: runDiagnose
  },
  backup: {
    description: '备份当前配置',
    usage: 'openclaw skill chat-hub-config backup [--name <name>] [--include-logs]',
    fn: runBackup
  },
  restore: {
    description: '从备份恢复配置',
    usage: 'openclaw skill chat-hub-config restore [--name <name>] [--list] [--dry-run]',
    fn: runRestore
  },
  repair: {
    description: '自动修复常见问题',
    usage: 'openclaw skill chat-hub-config repair [--list] [--fix <issue>] [--all]',
    fn: runRepair
  },
  start: {
    description: '启动 Chat-Hub 服务',
    usage: 'openclaw skill chat-hub-config start [--log] [--foreground]',
    fn: runStart
  },
  stop: {
    description: '停止 Chat-Hub 服务',
    usage: 'openclaw skill chat-hub-config stop',
    fn: runStop
  },
  restart: {
    description: '重启 Chat-Hub 服务',
    usage: 'openclaw skill chat-hub-config restart',
    fn: runRestart
  },
  status: {
    description: '查看服务状态',
    usage: 'openclaw skill chat-hub-config status',
    fn: runStatus
  },
  logs: {
    description: '查看服务日志',
    usage: 'openclaw skill chat-hub-config logs [--lines <n>]',
    fn: runLogs
  }
};

async function main(args) {
  const command = args[0] || 'help';

  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  if (!COMMANDS[command]) {
    console.error(`\n❌ 未知命令: ${command}`);
    console.log('\n使用 "openclaw skill chat-hub-config help" 查看可用命令');
    process.exit(1);
  }

  try {
    const commandArgs = args.slice(1);
    await COMMANDS[command].fn(commandArgs);
  } catch (error) {
    console.error(`\n❌ 执行命令失败: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║          Chat-Hub Config Skill - 帮助文档                  ║
╚════════════════════════════════════════════════════════════╝

📖 使用方法:
  openclaw skill chat-hub-config <命令> [选项]

📋 可用命令:

  配置管理:
    check      检查配置完整性和有效性
    setup      启动交互式配置向导
    diagnose   运行系统诊断并生成报告

  备份恢复:
    backup     备份当前配置
    restore    从备份恢复配置

  故障修复:
    repair     自动修复常见问题

  运行管理:
    start      启动 Chat-Hub 服务
    stop       停止 Chat-Hub 服务
    restart    重启 Chat-Hub 服务
    status     查看服务状态
    logs       查看服务日志

🔧 常用示例:

  # 首次配置
  openclaw skill chat-hub-config check
  openclaw skill chat-hub-config setup

  # 问题排查
  openclaw skill chat-hub-config diagnose
  openclaw skill chat-hub-config repair --list

  # 备份恢复
  openclaw skill chat-hub-config backup
  openclaw skill chat-hub-config restore --list

  # 服务管理
  openclaw skill chat-hub-config start
  openclaw skill chat-hub-config status
  openclaw skill chat-hub-config stop

📚 更多信息:
  查看 SKILL.md 获取详细文档
`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  main(args);
}

module.exports = { main, COMMANDS };
