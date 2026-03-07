<!--
  Agent 配置表单组件
  @author 小琳
  @date 2026-03-04
  功能：创建/编辑 Agent
-->
<template>
  <el-form 
    ref="formRef" 
    :model="form" 
    :rules="rules" 
    label-position="top"
    class="agent-config-form"
  >
    <!-- 基本信息 -->
    <div class="form-section">
      <h4 class="section-title">基本信息</h4>
      
      <el-form-item label="Agent 名称" prop="name">
        <el-input 
          v-model="form.name" 
          placeholder="给你的 Agent 起个名字"
          maxlength="50"
          show-word-limit
        />
      </el-form-item>
      
      <el-form-item label="显示昵称" prop="nickname">
        <el-input 
          v-model="form.nickname" 
          placeholder="显示给用户的昵称（可选）"
          maxlength="50"
        />
      </el-form-item>
      
      <el-form-item label="简介" prop="description">
        <el-input 
          v-model="form.description" 
          type="textarea"
          :rows="3"
          placeholder="描述一下这个 Agent 的功能..."
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
      
      <el-form-item label="头像" prop="avatar">
        <el-upload
          class="avatar-uploader"
          :show-file-list="false"
          :before-upload="beforeAvatarUpload"
          accept="image/*"
        >
          <el-avatar 
            v-if="form.avatar" 
            :src="form.avatar" 
            :size="64"
          />
          <div v-else class="avatar-placeholder">
            <el-icon><Plus /></el-icon>
            <span>上传头像</span>
          </div>
        </el-upload>
        <div class="avatar-tips">支持 jpg、png 格式，不超过 2MB</div>
      </el-form-item>
      
      <el-form-item label="可见性" prop="isPublic">
        <el-radio-group v-model="form.isPublic">
          <el-radio :value="false">
            <div class="radio-label">
              <el-icon><Lock /></el-icon>
              私有 - 仅自己可见
            </div>
          </el-radio>
          <el-radio :value="true">
            <div class="radio-label">
              <el-icon><View /></el-icon>
              公开 - 所有人可见
            </div>
          </el-radio>
        </el-radio-group>
      </el-form-item>
    </div>
    
    <!-- API 配置 -->
    <div class="form-section">
      <h4 class="section-title">
        API 配置
        <el-tooltip content="配置 Agent 调用的后端服务" placement="top">
          <el-icon class="help-icon"><QuestionFilled /></el-icon>
        </el-tooltip>
      </h4>
      
      <!-- 供应商选择 -->
      <el-form-item label="模型供应商" prop="provider">
        <el-select v-model="form.provider" placeholder="选择供应商" style="width: 100%" @change="onProviderChange">
          <el-option-group label="国际厂商">
            <el-option label="OpenAI" value="openai">
              <div class="provider-option">
                <span class="provider-icon">🟢</span>
                <span>OpenAI</span>
              </div>
            </el-option>
            <el-option label="Anthropic (Claude)" value="anthropic">
              <div class="provider-option">
                <span class="provider-icon">🟠</span>
                <span>Anthropic (Claude)</span>
              </div>
            </el-option>
            <el-option label="Google (Gemini)" value="google">
              <div class="provider-option">
                <span class="provider-icon">🔵</span>
                <span>Google (Gemini)</span>
              </div>
            </el-option>
          </el-option-group>
          <el-option-group label="国内厂商">
            <el-option label="阿里云 (通义千问)" value="alibaba">
              <div class="provider-option">
                <span class="provider-icon">🟣</span>
                <span>阿里云 (通义千问)</span>
              </div>
            </el-option>
            <el-option label="智谱 AI (GLM)" value="zhipu">
              <div class="provider-option">
                <span class="provider-icon">🔴</span>
                <span>智谱 AI (GLM)</span>
              </div>
            </el-option>
            <el-option label="DeepSeek" value="deepseek">
              <div class="provider-option">
                <span class="provider-icon">🟡</span>
                <span>DeepSeek</span>
              </div>
            </el-option>
            <el-option label="百川智能" value="baichuan">
              <div class="provider-option">
                <span class="provider-icon">⚪</span>
                <span>百川智能</span>
              </div>
            </el-option>
            <el-option label="月之暗面 (Kimi)" value="moonshot">
              <div class="provider-option">
                <span class="provider-icon">🌙</span>
                <span>月之暗面 (Kimi)</span>
              </div>
            </el-option>
          </el-option-group>
          <el-option-group label="其他">
            <el-option label="本地模型" value="local">
              <div class="provider-option">
                <span class="provider-icon">💻</span>
                <span>本地模型 (Ollama/vLLM)</span>
              </div>
            </el-option>
            <el-option label="自定义" value="custom">
              <div class="provider-option">
                <span class="provider-icon">⚙️</span>
                <span>自定义 API</span>
              </div>
            </el-option>
          </el-option-group>
        </el-select>
      </el-form-item>
      
      <!-- 模型选择（根据供应商动态显示） -->
      <el-form-item label="模型" prop="model">
        <el-select v-model="form.model" placeholder="选择模型" style="width: 100%" :disabled="!form.provider">
          <el-option 
            v-for="model in availableModels" 
            :key="model.value" 
            :label="model.label" 
            :value="model.value"
          >
            <div class="model-option">
              <span>{{ model.label }}</span>
              <el-tag v-if="model.tag" size="small" :type="model.tagType">{{ model.tag }}</el-tag>
            </div>
          </el-option>
        </el-select>
      </el-form-item>
      
      <!-- 自定义模型名称 -->
      <el-form-item 
        v-if="form.model === 'custom' || form.provider === 'custom'" 
        label="自定义模型名称" 
        prop="customModel"
      >
        <el-input v-model="form.customModel" placeholder="输入模型名称，如 gpt-4-0125-preview" />
      </el-form-item>
      
      <el-form-item 
        v-if="form.model === 'custom'" 
        label="自定义模型名称" 
        prop="customModel"
      >
        <el-input v-model="form.customModel" placeholder="输入模型名称" />
      </el-form-item>
      
      <el-form-item label="API Endpoint" prop="apiEndpoint">
        <el-input 
          v-model="form.apiEndpoint" 
          placeholder="https://api.example.com/v1/chat/completions"
        />
      </el-form-item>
      
      <el-form-item label="API Key" prop="apiKey">
        <el-input 
          v-model="form.apiKey" 
          type="password"
          placeholder="输入 API Key"
          show-password
        />
        <div class="field-tips">API Key 会被加密存储，请妥善保管</div>
      </el-form-item>
      
      <el-form-item label="Temperature" prop="temperature">
        <el-slider 
          v-model="form.temperature" 
          :min="0" 
          :max="2" 
          :step="0.1"
          show-input
          :show-input-controls="false"
        />
        <div class="field-tips">值越高回复越有创意，值越低回复越稳定</div>
      </el-form-item>
      
      <el-form-item label="Max Tokens" prop="maxTokens">
        <el-input-number 
          v-model="form.maxTokens" 
          :min="100" 
          :max="128000" 
          :step="100"
        />
      </el-form-item>
    </div>
    
    <!-- 能力定义 -->
    <div class="form-section">
      <h4 class="section-title">
        能力定义
        <el-button 
          type="primary" 
          size="small" 
          text
          @click="showCapabilityDialog = true"
        >
          <el-icon><Plus /></el-icon>
          添加能力
        </el-button>
      </h4>
      
      <el-form-item label="System Prompt" prop="systemPrompt">
        <el-input 
          v-model="form.systemPrompt" 
          type="textarea"
          :rows="6"
          placeholder="定义 Agent 的角色和行为规范..."
          maxlength="4000"
          show-word-limit
        />
      </el-form-item>
      
      <!-- 能力标签列表 -->
      <div class="capability-list" v-if="form.capabilities?.length">
        <el-tag 
          v-for="(cap, index) in form.capabilities" 
          :key="index"
          closable
          @close="removeCapability(index)"
          class="capability-item"
        >{{ cap }}</el-tag>
      </div>
      
      <!-- 工具配置 -->
      <el-form-item label="启用工具" prop="enabledTools">
        <el-checkbox-group v-model="form.enabledTools">
          <el-checkbox value="web_search">网络搜索</el-checkbox>
          <el-checkbox value="code_interpreter">代码解释器</el-checkbox>
          <el-checkbox value="image_gen">图片生成</el-checkbox>
          <el-checkbox value="file_reader">文件读取</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
    </div>
    
    <!-- 记忆配置 -->
    <div class="form-section">
      <h4 class="section-title">记忆配置</h4>
      
      <el-form-item label="启用长期记忆" prop="enableMemory">
        <el-switch v-model="form.enableMemory" />
        <span class="switch-label">
          Agent 将记住之前的对话内容
        </span>
      </el-form-item>
      
      <el-form-item 
        v-if="form.enableMemory" 
        label="记忆检索数量" 
        prop="memoryRetrievalCount"
      >
        <el-input-number 
          v-model="form.memoryRetrievalCount" 
          :min="1" 
          :max="20"
        />
        <span class="field-tips">对话时检索的相关记忆数量</span>
      </el-form-item>
    </div>
    
    <!-- 操作按钮 -->
    <div class="form-actions">
      <el-button @click="$emit('cancel')">取消</el-button>
      <el-button 
        type="primary" 
        @click="handleSubmit" 
        :loading="submitting"
      >
        {{ isEdit ? '保存修改' : '创建 Agent' }}
      </el-button>
    </div>
  </el-form>
  
  <!-- 添加能力弹窗 -->
  <el-dialog 
    v-model="showCapabilityDialog" 
    title="添加能力" 
    width="400px"
  >
    <el-input 
      v-model="newCapability" 
      placeholder="输入能力名称，如：代码生成、文档翻译"
      @keyup.enter="addCapability"
    />
    <div class="capability-suggestions">
      <span class="label">常用能力：</span>
      <el-tag 
        v-for="cap in capabilitySuggestions" 
        :key="cap"
        size="small"
        class="suggestion-tag"
        @click="newCapability = cap; addCapability()"
      >{{ cap }}</el-tag>
    </div>
    <template #footer>
      <el-button @click="showCapabilityDialog = false">取消</el-button>
      <el-button type="primary" @click="addCapability">添加</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Lock, View, QuestionFilled } from '@element-plus/icons-vue';

const props = defineProps({
  agent: {
    type: Object,
    default: null
  },
  submitting: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['submit', 'cancel']);

const formRef = ref(null);
const showCapabilityDialog = ref(false);
const newCapability = ref('');

// 是否编辑模式
const isEdit = computed(() => !!props.agent?.id);

// 表单数据
const form = ref({
  name: '',
  nickname: '',
  description: '',
  avatar: '',
  isPublic: false,
  provider: '',
  model: '',
  customModel: '',
  apiEndpoint: '',
  apiKey: '',
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: '',
  capabilities: [],
  enabledTools: [],
  enableMemory: true,
  memoryRetrievalCount: 5
});

// 供应商对应的模型列表
const providerModels = {
  openai: [
    { label: 'GPT-4o', value: 'gpt-4o', tag: '推荐', tagType: 'success' },
    { label: 'GPT-4o Mini', value: 'gpt-4o-mini', tag: '快速', tagType: 'info' },
    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
    { label: 'GPT-4', value: 'gpt-4' },
    { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo', tag: '经济', tagType: 'warning' }
  ],
  anthropic: [
    { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022', tag: '推荐', tagType: 'success' },
    { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022', tag: '快速', tagType: 'info' },
    { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
    { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
    { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307', tag: '经济', tagType: 'warning' }
  ],
  google: [
    { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash', tag: '推荐', tagType: 'success' },
    { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
    { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash', tag: '快速', tagType: 'info' },
    { label: 'Gemini 1.0 Pro', value: 'gemini-1.0-pro', tag: '经济', tagType: 'warning' }
  ],
  alibaba: [
    { label: 'Qwen-Max', value: 'qwen-max', tag: '最强', tagType: 'success' },
    { label: 'Qwen-Max-Longcontext', value: 'qwen-max-longcontext' },
    { label: 'Qwen-Plus', value: 'qwen-plus' },
    { label: 'Qwen-Turbo', value: 'qwen-turbo', tag: '快速', tagType: 'info' },
    { label: 'Qwen-Long', value: 'qwen-long' }
  ],
  zhipu: [
    { label: 'GLM-4-Plus', value: 'glm-4-plus', tag: '推荐', tagType: 'success' },
    { label: 'GLM-4-0520', value: 'glm-4-0520' },
    { label: 'GLM-4', value: 'glm-4' },
    { label: 'GLM-4-Air', value: 'glm-4-air', tag: '快速', tagType: 'info' },
    { label: 'GLM-4-Flash', value: 'glm-4-flash', tag: '免费', tagType: 'warning' }
  ],
  deepseek: [
    { label: 'DeepSeek-V3', value: 'deepseek-chat', tag: '推荐', tagType: 'success' },
    { label: 'DeepSeek-Reasoner (R1)', value: 'deepseek-reasoner', tag: '推理' }
  ],
  baichuan: [
    { label: 'Baichuan4', value: 'Baichuan4', tag: '推荐', tagType: 'success' },
    { label: 'Baichuan3-Turbo', value: 'Baichuan3-Turbo' },
    { label: 'Baichuan3-Turbo-128k', value: 'Baichuan3-Turbo-128k' }
  ],
  moonshot: [
    { label: 'Moonshot v1 8k', value: 'moonshot-v1-8k' },
    { label: 'Moonshot v1 32k', value: 'moonshot-v1-32k' },
    { label: 'Moonshot v1 128k', value: 'moonshot-v1-128k', tag: '长文本', tagType: 'info' }
  ],
  local: [
    { label: 'Llama 3.1 70B', value: 'llama3.1:70b' },
    { label: 'Llama 3.1 8B', value: 'llama3.1:8b', tag: '轻量', tagType: 'info' },
    { label: 'Qwen 2.5 72B', value: 'qwen2.5:72b' },
    { label: 'Mistral 7B', value: 'mistral:7b', tag: '轻量', tagType: 'info' },
    { label: 'DeepSeek V2', value: 'deepseek-v2:latest' },
    { label: '自定义本地模型', value: 'custom' }
  ],
  custom: [
    { label: '自定义模型', value: 'custom' }
  ]
};

// 根据供应商获取可用模型
const availableModels = computed(() => {
  return providerModels[form.value.provider] || [];
});

// 供应商变更时重置模型
function onProviderChange() {
  form.value.model = '';
  // 根据供应商预设 API Endpoint
  const endpoints = {
    openai: 'https://api.openai.com/v1/chat/completions',
    anthropic: 'https://api.anthropic.com/v1/messages',
    google: 'https://generativelanguage.googleapis.com/v1beta/models',
    alibaba: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
    baichuan: 'https://api.baichuan-ai.com/v1/chat/completions',
    moonshot: 'https://api.moonshot.cn/v1/chat/completions',
    local: 'http://localhost:11434/api/chat'
  };
  if (endpoints[form.value.provider] && !form.value.apiEndpoint) {
    form.value.apiEndpoint = endpoints[form.value.provider];
  }
}

// 验证规则
const rules = {
  name: [
    { required: true, message: '请输入 Agent 名称', trigger: 'blur' },
    { min: 2, max: 50, message: '名称长度在 2-50 个字符', trigger: 'blur' }
  ],
  model: [
    { required: true, message: '请选择模型', trigger: 'change' }
  ],
  systemPrompt: [
    { required: true, message: '请输入 System Prompt', trigger: 'blur' }
  ]
};

// 能力建议
const capabilitySuggestions = [
  '代码生成', '文档翻译', '数据分析', '写作助手', 
  '问答系统', '知识检索', '任务规划', '创意生成'
];

// 监听 agent 变化，填充表单
watch(() => props.agent, (agent) => {
  if (agent) {
    form.value = { ...form.value, ...agent };
  }
}, { immediate: true });

// 头像上传
function beforeAvatarUpload(file) {
  const isImage = file.type.startsWith('image/');
  const isLt2M = file.size / 1024 / 1024 < 2;
  
  if (!isImage) {
    ElMessage.error('只能上传图片文件');
    return false;
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB');
    return false;
  }
  
  // 转换为 base64
  const reader = new FileReader();
  reader.onload = (e) => {
    form.value.avatar = e.target.result;
  };
  reader.readAsDataURL(file);
  
  return false;
}

// 添加能力
function addCapability() {
  const cap = newCapability.value.trim();
  if (!cap) return;
  
  if (form.value.capabilities.includes(cap)) {
    ElMessage.warning('该能力已存在');
    return;
  }
  
  form.value.capabilities.push(cap);
  newCapability.value = '';
  showCapabilityDialog.value = false;
}

// 移除能力
function removeCapability(index) {
  form.value.capabilities.splice(index, 1);
}

// 提交表单
async function handleSubmit() {
  try {
    await formRef.value.validate();
    emit('submit', { ...form.value });
  } catch (e) {
    // 验证失败
  }
}
</script>

<style scoped>
.agent-config-form {
  max-width: 600px;
}

.form-section {
  margin-bottom: 24px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  font-size: 15px;
  color: #303133;
}

.help-icon {
  color: #909399;
  cursor: help;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 4px;
}

.avatar-uploader {
  display: inline-block;
}

.avatar-placeholder {
  width: 64px;
  height: 64px;
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.avatar-placeholder:hover {
  border-color: #409eff;
  color: #409eff;
}

.avatar-tips {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}

.field-tips {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.switch-label {
  margin-left: 8px;
  font-size: 13px;
  color: #606266;
}

.capability-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.capability-item {
  margin: 0;
}

.capability-suggestions {
  margin-top: 12px;
}

.capability-suggestions .label {
  font-size: 12px;
  color: #909399;
}

.suggestion-tag {
  margin-left: 8px;
  cursor: pointer;
  margin-bottom: 4px;
}

.suggestion-tag:hover {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #e4e7ed;
}

.provider-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-icon {
  font-size: 14px;
}

.model-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
</style>
