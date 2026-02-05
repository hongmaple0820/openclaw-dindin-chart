# 🦙 llama.cpp 本地大模型部署指南

> 整理者：✨ 小琳 | 更新于 2026-02-05

## 简介

llama.cpp 是一个高效的本地大模型推理框架，支持 CPU/GPU 运行，适合在个人电脑上部署 AI 模型。

## 安装步骤

### 1. 安装依赖

```bash
sudo apt install -y build-essential cmake
```

### 2. 编译 llama.cpp

```bash
cd ~
git clone https://github.com/ggml-org/llama.cpp.git
cd llama.cpp
mkdir -p build && cd build
cmake ..
cmake --build . --config Release -j$(nproc)
```

编译完成后，二进制文件在 `~/llama.cpp/build/bin/`

### 3. 下载模型

推荐使用国内镜像加速：

```bash
cd ~/llama.cpp/models

# Qwen 3B（适合 4GB 显卡）
wget https://hf-mirror.com/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf

# Qwen 7B（需要更大显存）
wget https://hf-mirror.com/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf
```

## 运行方式

### 命令行对话

```bash
cd ~/llama.cpp
./build/bin/llama-cli \
  -m models/qwen2.5-3b-instruct-q4_k_m.gguf \
  -p "你好，介绍一下自己" \
  -n 100
```

### OpenAI 兼容 API 服务

```bash
./build/bin/llama-server \
  -m models/qwen2.5-3b-instruct-q4_k_m.gguf \
  --host 0.0.0.0 \
  --port 11434 \
  -c 2048
```

启动后可用接口：
- `POST /v1/chat/completions` - 对话
- `POST /v1/completions` - 补全
- `GET /v1/models` - 模型列表

### 测试 API

```bash
curl http://127.0.0.1:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "你好"}],
    "max_tokens": 50
  }'
```

## 启动脚本

可以写一个管理脚本（start/stop/status）：

```bash
#!/bin/bash
LLAMA_DIR="$HOME/llama.cpp"
MODEL="$LLAMA_DIR/models/qwen2.5-3b-instruct-q4_k_m.gguf"
PIDFILE="/tmp/llama-server.pid"

case "$1" in
  start)
    nohup $LLAMA_DIR/build/bin/llama-server \
      -m "$MODEL" --host 0.0.0.0 --port 11434 -c 2048 \
      > /tmp/llama-server.log 2>&1 &
    echo $! > "$PIDFILE"
    echo "✅ 启动成功"
    ;;
  stop)
    kill $(cat "$PIDFILE") 2>/dev/null
    rm -f "$PIDFILE"
    echo "🛑 已停止"
    ;;
  status)
    if [ -f "$PIDFILE" ] && kill -0 $(cat "$PIDFILE") 2>/dev/null; then
      echo "✅ 运行中 (PID: $(cat $PIDFILE))"
    else
      echo "❌ 未运行"
    fi
    ;;
esac
```

## 显卡选择建议

| 显存 | 推荐模型 | 量化版本 |
|------|----------|----------|
| 4GB | Qwen2.5-3B | Q4_K_M |
| 8GB | Qwen2.5-7B | Q4_K_M |
| 16GB+ | Qwen2.5-14B | Q4_K_M |

## 常见问题

### Q: 模型下载太慢？
A: 使用 hf-mirror.com 替代 huggingface.co

### Q: GPU 没有被使用？
A: 编译时需要启用 CUDA：
```bash
cmake .. -DGGML_CUDA=ON
```

### Q: 内存不够？
A: 减小上下文长度 `-c 1024` 或使用更小的模型
