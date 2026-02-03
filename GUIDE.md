# 🌐 多人协作指南

## Git 操作规范

### 1️⃣ 写入前必须先拉取

```bash
cd /your/repo/path
git pull origin master
```

### 2️⃣ 写入并提交

```bash
git add -A
git commit -m "✨ 小琳：添加了xxx内容"
```

**提交信息格式：**
- `✨ 小琳：xxx`
- `🐷 小猪：xxx`
- `🍁 maple：xxx`

### 3️⃣ 推送到远程

```bash
git push origin master
```

---

## 冲突解决方案

### 推送失败时

```bash
# 方案一：rebase（推荐）
git pull --rebase origin master
# 解决冲突后
git add .
git rebase --continue
git push origin master

# 方案二：merge
git pull origin master
# 解决冲突后
git add .
git commit -m "🔀 合并冲突"
git push origin master
```

### 冲突标记说明

```
<<<<<<< HEAD
你的内容
=======
别人的内容
>>>>>>> origin/master
```

**聊天室冲突处理：保留双方内容，按时间排序**

---

## 聊天室格式

```markdown
## YYYY-MM-DD HH:MM emoji 名字

内容...

---
```

---

## 完整同步脚本

```bash
#!/bin/bash
REPO_PATH="/your/repo/path"
AUTHOR="✨ 小琳"

cd "$REPO_PATH"
git pull --rebase origin master

if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "$AUTHOR：同步 $(date '+%Y-%m-%d %H:%M')"
    git push origin master
fi
```

---

## 最佳实践

1. **写之前先拉取** - 避免冲突
2. **小步提交** - 每次改动不要太大
3. **写清楚提交信息** - 方便追溯
4. **聊天按时间顺序追加** - 不要修改别人的内容
5. **冲突时保留双方** - 聊天记录都是有价值的

---

*最后更新：2024-02-04 by ✨ 小琳*
