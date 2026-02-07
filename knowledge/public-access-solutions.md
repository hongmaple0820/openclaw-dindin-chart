# 本地服务公网暴露方案总结

> 作者：小琳  
> 日期：2026-02-07  
> 场景：将本地 chat-hub (localhost:3000) 暴露到公网

---

## 🎯 方案对比表

| 方案 | 难度 | 需要浏览器 | 费用 | HTTPS | URL稳定性 | 推荐场景 |
|------|------|-----------|------|-------|----------|---------|
| Cloudflare Quick Tunnel | 低 | ❌ | 免费 | 自动 | 随机 | 快速测试 |
| localtunnel | 低 | ❌ | 免费 | 自动 | 固定子域名 | 临时使用 ⭐ |
| Cloudflare Tunnel（完整版）| 中 | ✅ | 免费 | 自动 | 固定域名 | 生产环境 ⭐⭐⭐ |
| Tailscale | 低 | 手机授权 | 免费 | 自动 | 固定 | 虚拟专网 ⭐⭐⭐ |
| ngrok | 低 | 注册 | 免费/付费 | 自动 | 随机/固定 | 快速演示 |
| frp | 中 | ❌ | 需服务器 | 需配置 | 固定 | 自定义域名 |

---

## 方案 1：localtunnel（最快，当前使用）

### 特点
- ✅ 无需注册
- ✅ 1 条命令启动
- ✅ 固定子域名
- ✅ 自动 HTTPS
- ⚠️ 不稳定（适合临时使用）

### 安装
```bash
npm install -g localtunnel
```

### 启动
```bash
# 前台运行
lt --port 3000 --subdomain chat-maple

# 后台运行
nohup lt --port 3000 --subdomain chat-maple > /tmp/localtunnel.log 2>&1 &
```

### 访问地址
```
https://chat-maple.loca.lt
```

### 停止
```bash
pkill -f "lt --port"
```

### 优缺点
**优点**：
- 立即可用
- 无需任何授权
- 固定子域名

**缺点**：
- 不够稳定
- 速度一般
- 无 SLA 保证

---

## 方案 2：Cloudflare Quick Tunnel（最简单）

### 特点
- ✅ 无需注册
- ✅ 1 条命令启动
- ✅ 自动 HTTPS
- ⚠️ URL 随机（每次重启变化）

### 前提条件
安装 cloudflared：
```bash
# 下载预编译版本
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
```

### 启动
```bash
# 前台运行
cloudflared tunnel --url http://localhost:3000

# 后台运行
nohup cloudflared tunnel --url http://localhost:3000 > /tmp/cloudflared.log 2>&1 &

# 查看生成的 URL
grep "https://.*\.trycloudflare\.com" /tmp/cloudflared.log
```

### 访问地址示例
```
https://brooklyn-operational-legs-basename.trycloudflare.com
```

### 停止
```bash
pkill cloudflared
```

### 优缺点
**优点**：
- 无需授权
- Cloudflare 速度快
- 稳定性好

**缺点**：
- URL 随机
- 每次重启 URL 变化

---

## 方案 3：Cloudflare Tunnel（完整版，推荐生产）

### 特点
- ✅ 固定域名
- ✅ 自动 HTTPS
- ✅ 稳定性高
- ✅ 免费
- ⚠️ 需要浏览器授权

### 步骤

#### 1. 安装 cloudflared（同上）

#### 2. 登录 Cloudflare
```bash
cloudflared tunnel login
```
会打开浏览器，授权后生成 `~/.cloudflared/cert.pem`

#### 3. 创建 tunnel
```bash
cloudflared tunnel create chat-hub
```
记录输出的 `<TUNNEL-ID>`

#### 4. 配置 DNS
```bash
cloudflared tunnel route dns <TUNNEL-ID> chat.your-domain.com
```

#### 5. 创建配置文件
```bash
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml <<EOF
tunnel: <TUNNEL-ID>
credentials-file: /home/\$USER/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: chat.your-domain.com
    service: http://localhost:3000
  - service: http_status:404
EOF
```

#### 6. 启动 tunnel
```bash
# 前台运行
cloudflared tunnel run chat-hub

# 后台运行（systemd）
sudo systemctl enable cloudflared@chat-hub
sudo systemctl start cloudflared@chat-hub
```

### 访问地址
```
https://chat.your-domain.com
```

### 优缺点
**优点**：
- 固定域名
- 生产级稳定性
- Cloudflare CDN 加速
- 免费

**缺点**：
- 需要浏览器授权
- 配置稍复杂
- 需要自己的域名

---

## 方案 4：Tailscale（虚拟专网，推荐私密使用）

### 特点
- ✅ 不需要浏览器（手机授权）
- ✅ 点对点连接
- ✅ 自动 HTTPS（MagicDNS）
- ✅ 免费（个人使用）
- ⚠️ 需要在所有设备安装客户端

### 安装
```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

### 启动并授权
```bash
sudo tailscale up
```
复制输出的授权链接，在手机上打开完成授权

### 获取内网地址
```bash
tailscale ip -4
# 输出：100.64.0.1
```

### 访问地址
```
http://100.64.0.1:3000

# 或使用 MagicDNS（启用后）
https://hostname.tail<xxx>.ts.net:3000
```

### 优缺点
**优点**：
- 安全（虚拟专网）
- 速度快（点对点）
- 自动穿透 NAT
- 支持所有设备

**缺点**：
- 需要在所有访问设备安装客户端
- 不适合公开分享

---

## 方案 5：ngrok（快速演示）

### 特点
- ✅ 1 条命令启动
- ✅ 自动 HTTPS
- ⚠️ 需要注册
- ⚠️ 免费版 URL 随机

### 安装
```bash
# Debian/Ubuntu
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
```

### 配置
1. 注册：https://dashboard.ngrok.com/signup
2. 获取 authtoken
3. 配置：
```bash
ngrok config add-authtoken <你的token>
```

### 启动
```bash
ngrok http 3000
```

### 访问地址示例
```
https://abc123.ngrok-free.app
```

### 优缺点
**优点**：
- 功能强大
- 文档完善
- 付费版支持固定域名

**缺点**：
- 免费版 URL 随机
- 需要注册

---

## 方案 6：frp（自定义域名）

### 特点
- ✅ 完全自定义
- ✅ 可配置域名
- ⚠️ 需要公网服务器
- ⚠️ 需要手动配置 HTTPS

### 架构
```
本地服务 → frpc（客户端）→ 公网服务器 frps（服务端）→ 用户
```

### 服务端配置（公网服务器）
```ini
# frps.ini
[common]
bind_port = 7000
vhost_http_port = 80
vhost_https_port = 443
```

### 客户端配置（本地）
```ini
# frpc.ini
[common]
server_addr = your-server.com
server_port = 7000

[chat-hub]
type = http
local_port = 3000
custom_domains = chat.your-domain.com
```

### 启动
```bash
# 服务端
./frps -c frps.ini

# 客户端
./frpc -c frpc.ini
```

### 优缺点
**优点**：
- 完全控制
- 自定义域名
- 无第三方依赖

**缺点**：
- 需要公网服务器
- 配置复杂
- 需要手动配置 SSL

---

## 🎯 推荐方案

### 场景 1：快速测试（临时）
→ **localtunnel** 或 **Cloudflare Quick Tunnel**

### 场景 2：长期使用（公开访问）
→ **Cloudflare Tunnel（完整版）**

### 场景 3：私密访问（团队内部）
→ **Tailscale**

### 场景 4：演示/分享
→ **ngrok**

### 场景 5：自定义域名 + 完全控制
→ **frp**

---

## 📝 实战经验

### 2026-02-07 实践记录

#### 尝试顺序
1. ❌ Cloudflare Tunnel（完整版）- 无法打开浏览器授权
2. ⏸️ Tailscale - 下载卡住
3. ✅ **Cloudflare Quick Tunnel** - 成功运行
4. ✅ **localtunnel** - 当前使用

#### 当前配置
- **方案**：localtunnel
- **地址**：https://chat-maple.loca.lt
- **启动命令**：
  ```bash
  nohup lt --port 3000 --subdomain chat-maple > /tmp/localtunnel.log 2>&1 &
  ```
- **状态**：运行中 ✅

#### 经验总结
1. **优先尝试无需授权的方案**（localtunnel、Quick Tunnel）
2. **生产环境用 Cloudflare Tunnel**（需要一次性浏览器授权）
3. **团队协作用 Tailscale**（需要所有人安装客户端）
4. **临时演示用 localtunnel/ngrok**（即开即用）

---

## 🔧 故障排查

### 问题 1：端口被占用
```bash
# 检查端口占用
lsof -i :3000
netstat -tlnp | grep 3000

# 停止占用进程
kill <PID>
```

### 问题 2：隧道连接失败
```bash
# 检查本地服务是否运行
curl http://localhost:3000

# 查看隧道日志
tail -f /tmp/localtunnel.log
tail -f /tmp/cloudflared.log
```

### 问题 3：HTTPS 证书错误
- localtunnel：自动处理
- Cloudflare：自动处理
- frp：需要手动配置 Let's Encrypt

### 问题 4：速度慢
- 检查本地网络
- 尝试其他服务商（Cloudflare 通常最快）
- Tailscale 点对点连接速度最佳

---

## 📚 参考资料

- [Cloudflare Tunnel 官方文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Tailscale 快速开始](https://tailscale.com/kb/1017/install/)
- [localtunnel GitHub](https://github.com/localtunnel/localtunnel)
- [ngrok 文档](https://ngrok.com/docs)
- [frp GitHub](https://github.com/fatedier/frp)

---

**最后更新**：2026-02-07 23:32  
**维护者**：小琳  
**项目**：MapleChatRoom (chat-hub)
