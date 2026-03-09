# Chat-Web 项目 Bug 扫描报告

**项目**: 枫琳 - 人机共生智能协作平台  
**路径**: `/home/maple/.openclaw/projects/openclaw-dindin-chart/chat-web/`  
**扫描时间**: 2026-03-07  
**构建状态**: ✅ 成功

---

## 📋 Bug 列表

### 🔴 高优先级问题

#### 1. WebSocket 重连时静默失败
**文件**: `src/utils/websocket.js:126`
```javascript
this.connect().catch(() => {});
```
**问题**: 重连失败时没有任何错误处理或用户提示
**影响**: 用户可能不知道连接已断开，消息无法发送
**建议**: 添加重连失败提示，超过最大次数后通知用户

#### 2. 表单验证失败时静默处理
**文件**: 多个文件 (Login.vue, Register.vue, Profile.vue 等)
```javascript
const valid = await formRef.value?.validate().catch(() => false);
```
**问题**: 验证错误被静默捕获，用户不知道验证失败的具体原因
**影响**: 用户体验差，无法定位问题
**建议**: 显示具体的验证错误信息

#### 3. DefaultLayout 中未定义图标引用
**文件**: `src/layouts/DefaultLayout.vue`
**问题**: 使用了 `DArrowLeft` 和 `DArrowRight` 图标，但在 `<script setup>` 中未导入
```vue
<el-icon :size="18">
  <DArrowLeft v-if="!settingsStore.sidebarCollapsed" />
  <DArrowRight v-else />
</el-icon>
```
**影响**: 可能导致图标不显示或控制台警告
**建议**: 从 `@element-plus/icons-vue` 导入缺失的图标

---

### 🟠 中优先级问题

#### 4. DM.vue 移动端聊天区域隐藏但未实现切换
**文件**: `src/views/DM.vue`
```css
.chat-area {
  display: none;
}
```
**问题**: 移动端聊天区域被隐藏，但没有实现返回会话列表的功能
**影响**: 移动端用户无法正常使用私信功能
**建议**: 实现移动端会话列表和聊天区域的切换逻辑

#### 5. 好友页面分组展开逻辑问题
**文件**: `src/views/Friends.vue`
```javascript
onMounted(async () => {
  // ...
  activeGroups.value = Object.keys(friendStore.friendsByGroup);
});
```
**问题**: 在 `fetchFriends` 完成前设置 `activeGroups`，此时 `friendsByGroup` 可能为空
**影响**: 分组可能不会自动展开
**建议**: 在数据加载完成后再设置，或使用 watch 监听

#### 6. Chat.vue 中 sentMessageIds 未声明
**文件**: `src/views/Chat.vue:377`
```javascript
sentMessageIds.add(res.message?.id);
```
**问题**: `sentMessageIds` 在使用前声明为 `new Set()`，但位置在第 286 行
**影响**: 代码可读性差，可能导致维护问题
**建议**: 将 `sentMessageIds` 的声明移到更明显的位置，并添加注释

#### 7. 群聊页面路由查询参数类型问题
**文件**: `src/views/Groups.vue`
```javascript
currentGroupId.value = Number(groupId) || groupId;
```
**问题**: 当 `groupId` 是非数字字符串时，`Number(groupId)` 返回 `NaN`
**影响**: 可能导致群 ID 设置错误
**建议**: 统一 ID 类型处理逻辑

---

### 🟡 低优先级问题

#### 8. 大量 console.error 未统一处理
**文件**: `src/stores/*.js`
**问题**: 16+ 个文件中存在 console.error，但没有统一的错误处理机制
**影响**: 生产环境可能泄露敏感信息，难以追踪错误
**建议**: 使用统一的日志/错误处理服务

#### 9. TODO 注释未实现
**文件**: 多个文件
- `AdminLayout.vue:137` - 显示通知面板
- `About.vue:204` - 实现反馈提交
- `CreateGroup.vue:223` - 实现头像上传
- `GroupSettings.vue:230,301,354` - 多个未实现功能
**影响**: 功能不完整
**建议**: 创建 Issue 跟踪或实现这些功能

#### 10. 图片上传后 URL 处理不一致
**文件**: `src/views/Chat.vue`
```javascript
if (res.data?.success || res.success) {
  inputText.value += `\n![图片](${res.data?.url || res.url})\n`;
}
```
**问题**: 同时检查 `res.data` 和 `res`，API 响应格式不一致
**影响**: 可能导致图片链接插入失败
**建议**: 统一 API 响应格式

---

## 🔧 修复建议

### 立即修复 (高优先级)

1. **修复缺失的图标导入** - DefaultLayout.vue

```javascript
// 在 import 语句中添加
import { 
  Menu, ChatDotRound, ArrowDown, User, UserFilled, 
  ChatLineSquare, SwitchButton, MagicStick, List, 
  Setting, DataBoard, HomeFilled,
  Monitor, FolderOpened, DArrowLeft, DArrowRight  // 添加这两个
} from '@element-plus/icons-vue';
```

2. **改进 WebSocket 重连错误处理**

```javascript
// websocket.js
scheduleReconnect() {
  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    console.log('[WS] 达到最大重连次数');
    this.emit('reconnect_failed');
    return;
  }
  // ...
}
```

3. **改进表单验证错误处理**

```javascript
// 替换静默 catch
const valid = await formRef.value?.validate().catch((err) => {
  console.warn('表单验证失败:', err);
  return false;
});
```

### 后续优化 (中/低优先级)

1. 统一错误处理机制
2. 实现 TODO 标记的功能
3. 优化移动端体验
4. 添加 ESLint 配置文件

---

## 📊 统计

| 类别 | 数量 |
|------|------|
| 高优先级 Bug | 3 |
| 中优先级 Bug | 4 |
| 低优先级 Bug | 3 |
| TODO 未实现 | 8 |
| console.error 使用 | 50+ |

---

## ✅ 构建检查

- [x] `npm run build` 成功
- [ ] ESLint 配置缺失 (需要创建 eslint.config.js)
- [x] 无 TypeScript 错误
- [x] Vite 配置正常

---

## 📝 下一步行动

1. 修复高优先级 Bug (建议立即处理)
2. 创建 ESLint 配置文件
3. 统一错误处理机制
4. 实现 TODO 标记的功能
5. 添加单元测试