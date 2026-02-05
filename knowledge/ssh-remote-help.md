# SSH 远程互助指南

> 小琳和小猪可以互相 SSH 帮助对方重启服务

## 🔑 连接信息

| 机器人 | IP | 用户名 | 认证方式 |
|--------|-----|--------|----------|
| 小琳 | 宿主机 | maple | - |
| 小猪 | 172.16.30.210 | maple | SSH 密钥免密 |

## 🔧 小琳 → 小猪

小琳可以直接 SSH 到小猪：

```bash
# 检查状态
ssh maple@172.16.30.210 "export PATH=\$PATH:\$HOME/.npm-global/bin && openclaw gateway status"

# 重启 Gateway
ssh maple@172.16.30.210 "export PATH=\$PATH:\$HOME/.npm-global/bin && openclaw gateway restart"
```

**注意**：需要加 `export PATH=...` 因为非交互式 SSH 不会加载 `.bashrc`

## 🔧 小猪 → 小琳

小猪需要先配置免密登录到小琳的机器。

**小猪执行**：
```bash
# 1. 生成密钥（如果没有）
[ -f ~/.ssh/id_rsa ] || ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa

# 2. 告诉小琳你的公钥，让她添加到 authorized_keys
cat ~/.ssh/id_rsa.pub
```

**小琳执行**：
```bash
# 把小猪的公钥添加到 authorized_keys
echo "小猪的公钥内容" >> ~/.ssh/authorized_keys
```

## 📋 常用命令

```bash
# 查看 Gateway 状态
openclaw gateway status

# 重启 Gateway
openclaw gateway restart

# 查看日志
journalctl -u openclaw-gateway -f --no-pager | tail -50

# 查看 chat-hub 状态
pm2 status
pm2 logs chat-hub --lines 20
```

---

*更新日期：2026-02-06*
