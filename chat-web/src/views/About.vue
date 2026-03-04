<!--
  关于我们页面
  @author 小琳
  @date 2026-03-05
-->
<template>
  <div class="about-page">
    <div class="about-hero">
      <div class="maple-bg">
        <span class="maple maple-1">🍁</span>
        <span class="maple maple-2">🍂</span>
        <span class="maple maple-3">🍁</span>
        <span class="maple maple-4">🍂</span>
      </div>
      <div class="hero-content">
        <h1>枫琳 Fenlin</h1>
        <p class="version">v1.0.0</p>
        <p class="tagline">人机共生智能协作平台</p>
      </div>
    </div>

    <div class="about-content">
      <section class="about-section">
        <h2>🍁 关于枫琳</h2>
        <p>
          枫琳是一个人机共生的智能协作平台，让 AI 如枫叶般自然融入生活与工作。
          我们相信，人机协作应该是自然、和谐、可持续的。
        </p>
        <p>
          就像枫叶在四季中自然更迭，枫琳陪伴你在数字世界中成长、蜕变。
          每一片枫叶都是独特的，每个人与 AI 的协作方式也是独一无二的。
        </p>
      </section>

      <section class="about-section">
        <h2>✨ 核心理念</h2>
        <div class="values-grid">
          <div class="value-card">
            <div class="value-icon">🌳</div>
            <h3>自然共生</h3>
            <p>AI 如枫叶般自然融入，而非突兀的存在</p>
          </div>
          <div class="value-card">
            <div class="value-icon">🤝</div>
            <h3>协同成长</h3>
            <p>枫林成片，协作共生，共同进步</p>
          </div>
          <div class="value-card">
            <div class="value-icon">🔄</div>
            <h3>持续进化</h3>
            <p>枫叶四季蜕变，人机持续优化</p>
          </div>
          <div class="value-card">
            <div class="value-icon">🎨</div>
            <h3>个性定制</h3>
            <p>每一片枫叶都独特，每个人都是主角</p>
          </div>
        </div>
      </section>

      <section class="about-section">
        <h2>🚀 功能特性</h2>
        <div class="features-list">
          <div class="feature-item">
            <el-icon><ChatDotRound /></el-icon>
            <div class="feature-content">
              <h4>智能对话</h4>
              <p>与 AI 进行自然流畅的对话，获得专业的帮助和支持</p>
            </div>
          </div>
          <div class="feature-item">
            <el-icon><UserFilled /></el-icon>
            <div class="feature-content">
              <h4>智能体系统</h4>
              <p>创建和管理个性化智能体，让 AI 更懂你的需求</p>
            </div>
          </div>
          <div class="feature-item">
            <el-icon><MagicStick /></el-icon>
            <div class="feature-content">
              <h4>技能库</h4>
              <p>丰富的技能插件生态，扩展 AI 的能力边界</p>
            </div>
          </div>
          <div class="feature-item">
            <el-icon><Connection /></el-icon>
            <div class="feature-content">
              <h4>多平台协作</h4>
              <p>支持钉钉、企微等多平台接入，打破信息孤岛</p>
            </div>
          </div>
          <div class="feature-item">
            <el-icon><FolderOpened /></el-icon>
            <div class="feature-content">
              <h4>知识管理</h4>
              <p>个人网盘与知识库，构建专属知识体系</p>
            </div>
          </div>
          <div class="feature-item">
            <el-icon><List /></el-icon>
            <div class="feature-content">
              <h4>任务协作</h4>
              <p>高效的任务管理系统，让工作井井有条</p>
            </div>
          </div>
        </div>
      </section>

      <section class="about-section team-section">
        <h2>👥 团队</h2>
        <p>枫琳由一群热爱技术与自然的伙伴共同打造</p>
        <div class="team-grid">
          <div class="team-member">
            <el-avatar :size="64" class="member-avatar">🤖</el-avatar>
            <h4>小琳</h4>
            <p>AI 助手</p>
          </div>
          <div class="team-member">
            <el-avatar :size="64" class="member-avatar">👨‍💻</el-avatar>
            <h4>鸿枫</h4>
            <p>创始人</p>
          </div>
        </div>
      </section>

      <section class="about-section">
        <h2>📜 开源协议</h2>
        <p>枫琳采用 MIT 协议开源</p>
        <div class="license-links">
          <el-button text @click="openGitHub">
            <el-icon><Link /></el-icon>
            GitHub
          </el-button>
        </div>
      </section>

      <section class="about-section contact-section">
        <h2>📮 联系我们</h2>
        <p>有问题或建议？欢迎与我们联系</p>
        <div class="contact-links">
          <el-button type="primary" @click="showFeedback = true">
            <el-icon><ChatLineSquare /></el-icon>
            反馈建议
          </el-button>
        </div>
      </section>
    </div>

    <div class="about-footer">
      <p>© 2026 枫琳 Fenlin. 人机共生，自然之道</p>
      <p class="made-with">用 ❤️ 与 🍁 打造</p>
    </div>

    <!-- 反馈对话框 -->
    <el-dialog v-model="showFeedback" title="反馈建议" width="500px">
      <el-form :model="feedbackForm" label-position="top">
        <el-form-item label="反馈类型">
          <el-select v-model="feedbackForm.type" placeholder="请选择">
            <el-option label="功能建议" value="feature" />
            <el-option label="Bug 反馈" value="bug" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="详细描述">
          <el-input
            v-model="feedbackForm.content"
            type="textarea"
            :rows="4"
            placeholder="请描述你的建议或问题..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showFeedback = false">取消</el-button>
        <el-button type="primary" @click="submitFeedback">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { 
  ChatDotRound, UserFilled, MagicStick, Connection, 
  FolderOpened, List, Link, ChatLineSquare 
} from '@element-plus/icons-vue';

const showFeedback = ref(false);
const feedbackForm = ref({
  type: '',
  content: ''
});

const openGitHub = () => {
  window.open('https://github.com/openclaw/fenlin', '_blank');
};

const submitFeedback = () => {
  if (!feedbackForm.value.content.trim()) {
    ElMessage.warning('请填写反馈内容');
    return;
  }
  // TODO: 实现反馈提交
  ElMessage.success('感谢你的反馈！');
  showFeedback.value = false;
  feedbackForm.value = { type: '', content: '' };
};
</script>

<style scoped>
.about-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

/* 英雄区域 */
.about-hero {
  text-align: center;
  padding: 60px 20px;
  position: relative;
  overflow: hidden;
  margin-bottom: 40px;
}

.maple-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.maple {
  position: absolute;
  font-size: 40px;
  opacity: 0.1;
  animation: float 6s ease-in-out infinite;
}

.maple-1 { top: 10%; left: 10%; animation-delay: 0s; }
.maple-2 { top: 20%; right: 15%; animation-delay: 1s; }
.maple-3 { bottom: 20%; left: 20%; animation-delay: 2s; }
.maple-4 { bottom: 10%; right: 10%; animation-delay: 3s; }

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(10deg); }
}

.hero-content h1 {
  font-size: 48px;
  background: linear-gradient(135deg, #C41E3A 0%, #D4A017 50%, #228B22 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}

.hero-content .version {
  color: var(--fenlin-text-tertiary, #95A5A6);
  font-size: 14px;
  margin-bottom: 16px;
}

.hero-content .tagline {
  font-size: 20px;
  color: var(--fenlin-text-secondary, #5A6C7D);
}

/* 内容区域 */
.about-content {
  background: white;
  border-radius: var(--fenlin-radius-lg, 16px);
  box-shadow: var(--fenlin-shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.08));
  overflow: hidden;
}

.about-section {
  padding: 40px 32px;
  border-bottom: 1px solid var(--fenlin-border, #E0E0E0);
}

.about-section:last-child {
  border-bottom: none;
}

.about-section h2 {
  font-size: 24px;
  color: var(--fenlin-text-primary, #2C3E50);
  margin-bottom: 20px;
}

.about-section p {
  color: var(--fenlin-text-secondary, #5A6C7D);
  line-height: 1.8;
  margin-bottom: 16px;
}

/* 价值观卡片 */
.values-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.value-card {
  background: var(--fenlin-bg, #FAFAFA);
  border-radius: var(--fenlin-radius-md, 12px);
  padding: 24px;
  text-align: center;
  transition: var(--fenlin-transition, all 0.3s ease);
}

.value-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--fenlin-shadow-md, 0 4px 16px rgba(0, 0, 0, 0.12));
}

.value-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.value-card h3 {
  font-size: 16px;
  color: var(--fenlin-primary, #C41E3A);
  margin-bottom: 8px;
}

.value-card p {
  font-size: 14px;
  margin: 0;
}

/* 功能列表 */
.features-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: var(--fenlin-bg, #FAFAFA);
  border-radius: var(--fenlin-radius-md, 12px);
  transition: var(--fenlin-transition, all 0.3s ease);
}

.feature-item:hover {
  background: rgba(196, 30, 58, 0.05);
}

.feature-item .el-icon {
  font-size: 24px;
  color: var(--fenlin-primary, #C41E3A);
  margin-top: 2px;
}

.feature-content h4 {
  font-size: 16px;
  color: var(--fenlin-text-primary, #2C3E50);
  margin-bottom: 4px;
}

.feature-content p {
  font-size: 14px;
  margin: 0;
}

/* 团队 */
.team-grid {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-top: 24px;
}

.team-member {
  text-align: center;
}

.member-avatar {
  background: linear-gradient(135deg, #C41E3A 0%, #D4A017 100%);
  font-size: 28px;
  margin-bottom: 12px;
}

.team-member h4 {
  font-size: 16px;
  color: var(--fenlin-text-primary, #2C3E50);
  margin-bottom: 4px;
}

.team-member p {
  font-size: 14px;
  color: var(--fenlin-text-tertiary, #95A5A6);
  margin: 0;
}

/* 许可证 */
.license-links {
  margin-top: 16px;
}

/* 联系 */
.contact-links {
  margin-top: 20px;
}

/* 页脚 */
.about-footer {
  text-align: center;
  padding: 40px 20px;
  color: var(--fenlin-text-tertiary, #95A5A6);
}

.made-with {
  margin-top: 8px;
  font-size: 14px;
}

/* 响应式 */
@media (max-width: 768px) {
  .about-page {
    padding: 16px;
  }
  
  .about-hero {
    padding: 40px 16px;
  }
  
  .hero-content h1 {
    font-size: 36px;
  }
  
  .hero-content .tagline {
    font-size: 16px;
  }
  
  .about-section {
    padding: 24px 20px;
  }
  
  .about-section h2 {
    font-size: 20px;
  }
  
  .values-grid {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  
  .value-card {
    padding: 16px;
  }
  
  .feature-item {
    padding: 16px;
  }
  
  .team-grid {
    flex-direction: column;
    gap: 24px;
  }
}
</style>