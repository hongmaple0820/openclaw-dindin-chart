# chat-hub 配置踩坑经验总结

## 1. 钉钉webhook配置问题

### 问题：机器人不存在
- **错误信息**：`{ errcode: 300001, errmsg: '错误描述: robot 不存在；解决方案:请确认 token 是否正确；' }`
- **原因**：使用了错误的钉钉机器人token或机器人已被删除
- **解决方案**：确认使用正确的token和密钥

### 问题：发送失败
- **原因**：token与密钥不匹配
- **解决方案**：确保webhook URL中的token与配置的secret对应

## 2. 共用仓库配置隔离

### 问题：git pull覆盖个性化配置
- **错误做法**：修改config/default.json
- **正确做法**：只修改config/local.json，该文件在.gitignore中不会被同步
- **重要**：每个人使用自己的local.json配置

## 3. 机器人名称配置

### 问题：无法触发响应
- **原因**：chat-hub中的bot.name与消息中提及的名称不一致
- **解决方案**：确保bot.name配置与实际需要触发的名称相同

## 4. OpenClaw触发器问题

### 问题：执行命令失败
- **错误信息**：`Command failed: openclaw system event ... --timeout 10000`
- **原因**：
  - openclaw命令不在PATH中
  - Gateway服务未运行
  - 权限不足
- **解决方案**：
  - 确保PATH包含openclaw路径：`export PATH="$HOME/.npm-global/bin:$PATH"`
  - 启动Gateway服务：`openclaw gateway start`
  - 确保chat-hub以正确的用户运行

## 5. 实时通信问题

### 问题：无法及时响应消息
- **原因**：依赖心跳检查而非实时监听
- **解决方案**：配置OpenClaw触发器实现实时响应

## 6. 脚本配置问题

### 问题：独立脚本使用错误配置
- **原因**：单独的webhook脚本使用了过时或错误的token
- **解决方案**：确保所有相关脚本都使用相同的正确配置

## 7. 环境变量问题

### 问题：服务重启后命令找不到
- **原因**：重启服务时未设置正确的环境变量
- **解决方案**：在启动服务前设置PATH环境变量

## 8. 配置验证步骤

### 排查命令清单：
```bash
# 检查 OpenClaw 命令是否可用
which openclaw
openclaw --version

# 检查 Gateway 是否运行
openclaw gateway status

# 手动测试触发
openclaw system event --text "手动测试" --mode now

# 查看具体错误
tail -100 /tmp/chat-hub.log | grep -B 2 -A 2 "失败"

# 检查 chat-hub 进程
ps aux | grep chat-hub
```

---
这份总结基于小猪(lin-bot)的配置经验，供后续参考使用。