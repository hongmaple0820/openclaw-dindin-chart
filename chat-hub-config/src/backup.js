const fs = require('fs');
const path = require('path');
const os = require('os');

const CHAT_HUB_PATH = path.join(__dirname, '../../chat-hub');
const CONFIG_PATH = path.join(CHAT_HUB_PATH, 'config');
const BACKUP_DIR = path.join(os.homedir(), '.openclaw', 'chat-hub-backups');

class BackupManager {
  constructor() {
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  async backup(options = {}) {
    const name = options.name || this.generateBackupName();
    const includeLogs = options.includeLogs || false;
    const backupPath = path.join(BACKUP_DIR, name);

    console.log('\n📦 开始备份配置...');
    console.log(`备份路径: ${backupPath}`);

    fs.mkdirSync(backupPath, { recursive: true });

    const filesToBackup = [
      { src: 'config/local.json', dest: 'config.json', required: false },
      { src: 'config/default.json', dest: 'default-config.json', required: true },
      { src: '.env', dest: '.env', required: false }
    ];

    if (includeLogs) {
      filesToBackup.push(
        { src: 'logs', dest: 'logs', required: false }
      );
    }

    const results = [];

    for (const file of filesToBackup) {
      const srcPath = path.join(CHAT_HUB_PATH, file.src);
      const destPath = path.join(backupPath, file.dest);

      if (fs.existsSync(srcPath)) {
        try {
          const stat = fs.statSync(srcPath);
          if (stat.isDirectory()) {
            this.copyDirectory(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
          console.log(`  ✅ 已备份: ${file.src}`);
          results.push({ file: file.src, status: 'success' });
        } catch (e) {
          console.log(`  ❌ 备份失败: ${file.src} - ${e.message}`);
          results.push({ file: file.src, status: 'failed', error: e.message });
        }
      } else if (file.required) {
        console.log(`  ⚠️ 必需文件不存在: ${file.src}`);
        results.push({ file: file.src, status: 'missing' });
      } else {
        console.log(`  ⏭️ 跳过: ${file.src} (不存在)`);
        results.push({ file: file.src, status: 'skipped' });
      }
    }

    const metadata = {
      name,
      timestamp: new Date().toISOString(),
      version: this.getVersion(),
      includeLogs,
      files: results,
      status: results.some(r => r.status === 'failed') ? 'partial' : 'success'
    };

    fs.writeFileSync(
      path.join(backupPath, 'backup-info.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log('\n' + '═'.repeat(50));
    console.log(`✅ 备份完成: ${name}`);
    console.log('═'.repeat(50));

    return { name, path: backupPath, metadata };
  }

  async restore(options = {}) {
    const name = options.name;
    const dryRun = options.dryRun || false;
    const listOnly = options.list || false;

    if (listOnly) {
      return this.listBackups();
    }

    if (!name) {
      console.log('\n❌ 请指定备份名称');
      console.log('使用 --list 查看可用备份');
      console.log('示例: openclaw skill chat-hub-config restore --name backup-20260213');
      return null;
    }

    const backupPath = path.join(BACKUP_DIR, name);

    if (!fs.existsSync(backupPath)) {
      console.log(`\n❌ 备份不存在: ${name}`);
      return this.listBackups();
    }

    const infoPath = path.join(backupPath, 'backup-info.json');
    if (!fs.existsSync(infoPath)) {
      console.log(`\n❌ 备份信息文件损坏: ${name}`);
      return null;
    }

    const metadata = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));

    console.log('\n📥 恢复配置...');
    console.log(`备份时间: ${metadata.timestamp}`);
    console.log(`备份名称: ${name}`);

    if (dryRun) {
      console.log('\n🔍 模拟恢复模式 (不会实际修改文件)');
    }

    const filesToRestore = [
      { src: 'config.json', dest: 'config/local.json' },
      { src: 'default-config.json', dest: 'config/default.json' },
      { src: '.env', dest: '.env' }
    ];

    for (const file of filesToRestore) {
      const srcPath = path.join(backupPath, file.src);
      const destPath = path.join(CHAT_HUB_PATH, file.dest);

      if (fs.existsSync(srcPath)) {
        if (dryRun) {
          console.log(`  🔍 将恢复: ${file.dest}`);
        } else {
          const destDir = path.dirname(destPath);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.copyFileSync(srcPath, destPath);
          console.log(`  ✅ 已恢复: ${file.dest}`);
        }
      } else {
        console.log(`  ⏭️ 跳过: ${file.src} (备份中不存在)`);
      }
    }

    if (dryRun) {
      console.log('\n🔍 模拟恢复完成，未实际修改任何文件');
    } else {
      console.log('\n' + '═'.repeat(50));
      console.log('✅ 配置恢复完成');
      console.log('═'.repeat(50));
      console.log('\n💡 提示: 运行 "openclaw skill chat-hub-config check" 验证配置');
    }

    return { name, path: backupPath, metadata, dryRun };
  }

  listBackups() {
    console.log('\n📋 可用备份列表:');
    console.log('═'.repeat(50));

    const dirs = fs.readdirSync(BACKUP_DIR).filter(name => {
      const stat = fs.statSync(path.join(BACKUP_DIR, name));
      return stat.isDirectory();
    });

    if (dirs.length === 0) {
      console.log('暂无备份');
      console.log('使用 "openclaw skill chat-hub-config backup" 创建备份');
      return [];
    }

    const backups = dirs.map(name => {
      const infoPath = path.join(BACKUP_DIR, name, 'backup-info.json');
      if (fs.existsSync(infoPath)) {
        return JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
      }
      return { name, timestamp: '未知' };
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    backups.forEach((backup, index) => {
      const date = new Date(backup.timestamp);
      const dateStr = date.toLocaleString('zh-CN');
      const status = backup.status === 'success' ? '✅' : '⚠️';
      console.log(`  ${index + 1}. ${status} ${backup.name}`);
      console.log(`     时间: ${dateStr}`);
      if (backup.includeLogs) {
        console.log(`     包含日志`);
      }
    });

    console.log('\n💡 使用 "openclaw skill chat-hub-config restore --name <备份名>" 恢复配置');

    return backups;
  }

  deleteBackup(name) {
    const backupPath = path.join(BACKUP_DIR, name);

    if (!fs.existsSync(backupPath)) {
      console.log(`\n❌ 备份不存在: ${name}`);
      return false;
    }

    fs.rmSync(backupPath, { recursive: true, force: true });
    console.log(`\n✅ 已删除备份: ${name}`);
    return true;
  }

  generateBackupName() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
    return `backup-${date}-${time}`;
  }

  getVersion() {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(CHAT_HUB_PATH, 'package.json'), 'utf-8')
      );
      return packageJson.version || 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

async function runBackup(args) {
  const options = {
    name: args.includes('--name') ? args[args.indexOf('--name') + 1] : null,
    includeLogs: args.includes('--include-logs')
  };

  const manager = new BackupManager();
  return await manager.backup(options);
}

async function runRestore(args) {
  const options = {
    name: args.includes('--name') ? args[args.indexOf('--name') + 1] : null,
    dryRun: args.includes('--dry-run'),
    list: args.includes('--list')
  };

  const manager = new BackupManager();
  return await manager.restore(options);
}

module.exports = { BackupManager, runBackup, runRestore };
