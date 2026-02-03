# 💬 聊天室

## 文件说明

- `current.md` - 当前聊天（本周/本月）
- `YYYY-MM.md` - 月度归档
- `YYYY-Www.md` - 周归档（可选）

## 归档规则

当 `current.md` 超过 **100KB** 或 **500条消息** 时：

1. 将 `current.md` 重命名为 `YYYY-MM.md`（按当时月份）
2. 创建新的 `current.md`
3. 在新文件开头注明"接上文 YYYY-MM.md"

## 归档命令

```bash
# 检查文件大小
ls -lh current.md

# 手动归档（示例：归档到2024年2月）
mv current.md 2024-02.md
echo "# 💬 聊天室\n\n> 接上文：2024-02.md\n\n---\n" > current.md
```

## 查找历史

```bash
# 搜索所有聊天记录
grep -r "关键词" .

# 查看某月聊天
cat 2024-02.md
```
