# 枫琳品牌设计规范

## 🍁 品牌核心

**品牌名称**: 枫琳 (Fenlin)  
**品牌定位**: 人机共生智能协作平台  
**核心价值**: 让 AI 如枫叶般自然融入生活与工作

## 🎨 色彩系统

### 主色调 - 枫叶红
```css
--fenlin-primary: #C41E3A        /* 主色 - 温暖、活力、信任 */
--fenlin-primary-light: #E63950   /* 浅色 */
--fenlin-primary-lighter: #FF6B7A /* 更浅 */
--fenlin-primary-dark: #A01830    /* 深色 */
```

### 辅助色 - 秋金黄
```css
--fenlin-secondary: #D4A017       /* 辅助色 - 收获、价值、希望 */
--fenlin-secondary-light: #F5C842
--fenlin-secondary-lighter: #FFE082
```

### 点缀色 - 自然绿
```css
--fenlin-accent: #228B22          /* 点缀色 - 成长、生命、和谐 */
--fenlin-accent-light: #32CD32
--fenlin-accent-lighter: #90EE90
```

### 中性色
```css
--fenlin-bg: #FAFAFA              /* 背景色 */
--fenlin-bg-secondary: #F5F5F5    /* 次级背景 */
--fenlin-surface: #FFFFFF         /* 表面色 */
--fenlin-border: #E0E0E0          /* 边框色 */
```

### 文字色
```css
--fenlin-text-primary: #2C3E50    /* 主要文字 */
--fenlin-text-secondary: #5A6C7D  /* 次要文字 */
--fenlin-text-tertiary: #95A5A6   /* 辅助文字 */
```

## 🎭 渐变系统

### 主渐变
```css
--fenlin-gradient-primary: linear-gradient(135deg, #C41E3A 0%, #E63950 100%)
```
用于：主要按钮、重要标题

### 暖色渐变
```css
--fenlin-gradient-warm: linear-gradient(135deg, #C41E3A 0%, #D4A017 100%)
```
用于：Logo、品牌标题、特殊强调

### 自然渐变
```css
--fenlin-gradient-nature: linear-gradient(135deg, #228B22 0%, #D4A017 100%)
```
用于：成长相关、环保主题

### 完整品牌渐变
```css
linear-gradient(135deg, #C41E3A 0%, #D4A017 50%, #228B22 100%)
```
用于：品牌大标题、特殊装饰

## 📐 设计元素

### 圆角
```css
--fenlin-radius-sm: 8px    /* 小圆角 - 按钮、输入框 */
--fenlin-radius-md: 12px   /* 中圆角 - 卡片 */
--fenlin-radius-lg: 16px   /* 大圆角 - 大卡片 */
--fenlin-radius-xl: 24px   /* 超大圆角 - 特殊容器 */
```

### 阴影
```css
--fenlin-shadow-sm: 0 2px 8px rgba(196, 30, 58, 0.08)   /* 小阴影 */
--fenlin-shadow-md: 0 4px 16px rgba(196, 30, 58, 0.12)  /* 中阴影 */
--fenlin-shadow-lg: 0 8px 32px rgba(196, 30, 58, 0.16)  /* 大阴影 */
```

### 动画
```css
--fenlin-transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)
```

## 🍂 枫叶元素使用

### 装饰性枫叶
- 大小：120px - 200px
- 透明度：0.02 - 0.05
- 旋转：-20deg 到 30deg
- 位置：背景装饰，不干扰内容

### 功能性枫叶
- Logo 图标：32px
- 导航图标：24px
- 装饰图标：使用 emoji 🍁 或 SVG

### 枫叶动画
```css
@keyframes maple-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-10px) rotate(5deg); }
}
```

## 📱 组件设计规范

### 按钮
- 主按钮：枫叶红渐变 + 白色文字
- 次按钮：白色背景 + 枫叶红边框
- 悬停效果：上移 2-3px + 阴影加深

### 卡片
- 背景：白色
- 圆角：16-20px
- 阴影：轻微品牌色阴影
- 悬停：上移 4-8px + 顶部渐变条

### 导航
- 激活状态：枫叶红色 + 底部边框
- 悬停：浅色背景 + 枫叶红文字
- 圆角：8px

## 🎯 品牌应用场景

### 首页
- 大标题使用完整品牌渐变
- 三个特性卡片分别使用三种品牌色
- 背景装饰性枫叶

### 协作空间
- 顶部导航使用主色
- 消息气泡使用柔和色调
- 私聊功能突出"枫语私语"概念

### 管理后台
- 侧边栏使用枫叶红渐变背景
- 激活项使用秋金黄强调
- 数据可视化使用品牌色系

## 📝 文案规范

### 品牌 Slogan
- 主 Slogan：「枫琳，让智能自然融入生活」
- 副 Slogan：「人机共生，自然之道」

### 功能命名
- 聊天室 → 协作空间
- 私信 → 枫语私语
- 进入聊天室 → 开始协作
- 发起私聊 → 枫语私语

### 品牌关键词
- 共生、自然、协作、陪伴、成长
- 枫叶、四季、流转、和谐

## 🔧 技术实现

### CSS 变量引入
```javascript
import './styles/brand.css'
```

### Element Plus 主题定制
```javascript
app.use(ElementPlus, {
  // 使用品牌色覆盖默认主题
})
```

### 响应式断点
- 移动端：< 768px
- 平板：768px - 1024px
- 桌面：> 1024px

## 📊 设计检查清单

- [ ] 使用品牌色系
- [ ] 应用品牌圆角规范
- [ ] 添加品牌阴影效果
- [ ] 使用枫叶装饰元素
- [ ] 应用品牌动画效果
- [ ] 使用品牌文案
- [ ] 响应式设计
- [ ] 无障碍访问

## 🎨 设计资源

- 枫叶 SVG 图标：`/public/maple-leaf.svg`
- 品牌 CSS：`/src/styles/brand.css`
- 色彩变量：CSS 变量系统
- 字体：系统默认字体栈

---

**设计理念**: 如枫叶般自然、温暖、充满生命力，让技术与人文完美融合。
