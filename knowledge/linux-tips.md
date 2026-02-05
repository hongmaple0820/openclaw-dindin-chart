# 🐧 Linux 实用技巧

> 整理者：✨ 小琳 | 更新于 2026-02-05

## 截图方法（适用于图形界面）

### scrot - 轻量命令行截图
```bash
sudo apt install scrot

# 全屏截图
scrot screenshot.png

# 延迟 3 秒
scrot -d 3 screenshot.png

# 选区截图
scrot -s screenshot.png
```

### flameshot - 功能强大（推荐）
```bash
sudo apt install flameshot

# 启动截图界面
flameshot gui

# 全屏截图保存到指定路径
flameshot full -p ~/screenshots/
```

### SSH 远程截图
关键：需要设置 DISPLAY 环境变量

```bash
DISPLAY=:0 scrot /tmp/screenshot.png
DISPLAY=:0 flameshot full -p /tmp/
```

## 定时任务

### crontab 语法
```
分 时 日 月 周 命令
*  *  *  *  *  command

# 示例
0 8 * * *     # 每天 8:00
*/5 * * * *   # 每 5 分钟
0 0 * * 0     # 每周日 0:00
```

### 常用操作
```bash
# 编辑当前用户的 crontab
crontab -e

# 查看当前任务
crontab -l

# 查看系统级任务
cat /etc/crontab
```

## 时区设置

```bash
# 查看当前时区
timedatectl

# 设置时区
sudo timedatectl set-timezone Asia/Shanghai

# 列出可用时区
timedatectl list-timezones | grep Asia
```

## SSH 免密登录

```bash
# 1. 生成密钥（本地机器）
ssh-keygen -t ed25519 -C "your-email@example.com"

# 2. 复制公钥到远程机器
ssh-copy-id user@remote-ip

# 或手动添加
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
```

## 进程管理

```bash
# 查找进程
pgrep -f "关键词"
ps aux | grep "关键词"

# 后台运行
nohup command > /tmp/output.log 2>&1 &

# 查看后台任务
jobs -l

# 杀进程
kill PID
kill -9 PID  # 强制
pkill -f "关键词"
```

## 文件操作

```bash
# 安全删除（移到回收站）
trash-put file.txt  # 需要安装 trash-cli

# 查找文件
find /path -name "*.md"
find /path -name "*.log" -mtime +7  # 7 天前的日志

# 批量替换
sed -i 's/旧文本/新文本/g' file.txt

# 查找包含关键词的文件
grep -r "关键词" /path/
grep -l "关键词" *.md  # 只显示文件名
```

## Git 常用操作

```bash
# 配置用户
git config user.name "名字"
git config user.email "email@example.com"

# 拉取并变基（避免多余的 merge commit）
git pull --rebase origin master

# 查看状态
git status
git log --oneline -10

# 撤销修改
git checkout -- file.txt  # 撤销工作区修改
git reset HEAD file.txt   # 撤销暂存区
```
