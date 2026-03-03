<template>
  <view class="create-character-page">
    <scroll-view scroll-y class="scroll-container">
      <!-- 头像上传 -->
      <view class="avatar-section">
        <view class="avatar-upload" @click="chooseAvatar">
          <image v-if="form.avatar" :src="form.avatar" mode="aspectFill" />
          <view class="avatar-placeholder" v-else>
            <text class="plus-icon">+</text>
            <text class="hint">上传头像</text>
          </view>
        </view>
        <text class="avatar-tip">点击上传角色头像</text>
      </view>
      
      <!-- 基本信息表单 -->
      <view class="form-section">
        <view class="form-item">
          <text class="label">角色名称 <text class="required">*</text></text>
          <input 
            class="input" 
            v-model="form.name" 
            placeholder="请输入角色名称"
            maxlength="20"
          />
        </view>
        
        <view class="form-item">
          <text class="label">角色类型</text>
          <picker 
            :value="typeIndex" 
            :range="typeOptions" 
            @change="onTypeChange"
          >
            <view class="picker">
              <text>{{ form.type || '请选择角色类型' }}</text>
              <text class="arrow">›</text>
            </view>
          </picker>
        </view>
        
        <view class="form-item">
          <text class="label">性格特征</text>
          <view class="tags-input">
            <view class="tag" v-for="(tag, idx) in form.personality" :key="idx">
              <text>{{ tag }}</text>
              <text class="remove" @click="removeTag(idx)">×</text>
            </view>
            <input 
              class="tag-input" 
              v-model="tagInput" 
              placeholder="输入后回车添加"
              @confirm="addTag"
              maxlength="10"
            />
          </view>
        </view>
        
        <view class="form-item">
          <text class="label">说话风格</text>
          <textarea 
            class="textarea" 
            v-model="form.speakingStyle" 
            placeholder="描述角色的说话风格、语气特点等..."
            maxlength="500"
          />
          <text class="count">{{ form.speakingStyle?.length || 0 }}/500</text>
        </view>
      </view>
      
      <!-- 参考图片 -->
      <view class="ref-images-section">
        <text class="section-title">参考图片</text>
        <view class="images-grid">
          <view 
            class="image-item" 
            v-for="(img, idx) in form.referenceImages" 
            :key="idx"
          >
            <image :src="img" mode="aspectFill" @click="previewImage(img)" />
            <view class="remove-btn" @click="removeImage(idx)">×</view>
          </view>
          <view class="add-image" @click="chooseRefImage" v-if="form.referenceImages.length < 9">
            <text class="plus">+</text>
            <text class="text">添加图片</text>
          </view>
        </view>
        <text class="tip">最多上传9张参考图片</text>
      </view>
    </scroll-view>
    
    <!-- 提交按钮 -->
    <view class="submit-area">
      <button class="submit-btn" :loading="submitting" @click="handleSubmit">
        {{ isEdit ? '保存修改' : '创建角色' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { uploadApi } from '@/api/index'

const characterStore = useCharacterStore

const characterId = ref('')
const isEdit = ref(false)
const submitting = ref(false)
const tagInput = ref('')
const typeIndex = ref(-1)

const typeOptions = [
  '虚拟伴侣',
  'AI助手',
  '角色扮演',
  '情感陪伴',
  '教育辅导',
  '其他'
]

const form = reactive({
  name: '',
  type: '',
  avatar: '',
  personality: [] as string[],
  speakingStyle: '',
  referenceImages: [] as string[]
})

// 加载编辑数据
onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  characterId.value = currentPage?.options?.id || ''
  isEdit.value = currentPage?.options?.mode === 'edit'
  
  if (characterId.value && isEdit.value) {
    uni.setNavigationBarTitle({ title: '编辑角色' })
    try {
      const data = await characterStore.getCharacterById(characterId.value)
      if (data) {
        form.name = data.name || ''
        form.type = data.type || ''
        form.avatar = data.avatar || ''
        form.personality = data.personality || []
        form.speakingStyle = data.speakingStyle || ''
        form.referenceImages = data.referenceImages || []
        typeIndex.value = typeOptions.indexOf(form.type)
      }
    } catch (error) {
      console.error('加载角色数据失败:', error)
    }
  }
})

// 获取页面栈
const getCurrentPages = () => {
  return getCurrentPages()
}

// 选择头像
const chooseAvatar = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const tempFilePath = res.tempFilePaths[0]
      uni.showLoading({ title: '上传中...' })
      try {
        const data = await uploadApi.uploadImage(tempFilePath) as any
        form.avatar = data.url || data.data?.url
        uni.hideLoading()
      } catch (error) {
        uni.hideLoading()
        uni.showToast({ title: '上传失败', icon: 'none' })
      }
    }
  })
}

// 选择类型
const onTypeChange = (e: any) => {
  typeIndex.value = e.detail.value
  form.type = typeOptions[typeIndex.value]
}

// 添加标签
const addTag = () => {
  const tag = tagInput.value.trim()
  if (!tag) return
  if (form.personality.length >= 10) {
    uni.showToast({ title: '最多10个标签', icon: 'none' })
    return
  }
  if (form.personality.includes(tag)) {
    uni.showToast({ title: '标签已存在', icon: 'none' })
    return
  }
  form.personality.push(tag)
  tagInput.value = ''
}

// 移除标签
const removeTag = (idx: number) => {
  form.personality.splice(idx, 1)
}

// 选择参考图片
const chooseRefImage = () => {
  const remain = 9 - form.referenceImages.length
  if (remain <= 0) return
  
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      uni.showLoading({ title: '上传中...' })
      try {
        for (const path of res.tempFilePaths) {
          const data = await uploadApi.uploadImage(path) as any
          form.referenceImages.push(data.url || data.data?.url)
        }
        uni.hideLoading()
      } catch (error) {
        uni.hideLoading()
        uni.showToast({ title: '上传失败', icon: 'none' })
      }
    }
  })
}

// 预览图片
const previewImage = (current: string) => {
  uni.previewImage({
    current,
    urls: form.referenceImages
  })
}

// 移除图片
const removeImage = (idx: number) => {
  form.referenceImages.splice(idx, 1)
}

// 提交表单
const handleSubmit = async () => {
  // 验证
  if (!form.name.trim()) {
    uni.showToast({ title: '请输入角色名称', icon: 'none' })
    return
  }
  
  submitting.value = true
  uni.showLoading({ title: isEdit.value ? '保存中...' : '创建中...' })
  
  try {
    const data = {
      name: form.name.trim(),
      type: form.type,
      avatar: form.avatar,
      personality: form.personality,
      speakingStyle: form.speakingStyle,
      referenceImages: form.referenceImages
    }
    
    if (isEdit.value) {
      await characterStore.updateCharacter(characterId.value, data)
      uni.showToast({ title: '保存成功', icon: 'success' })
    } else {
      await characterStore.createCharacter(data)
      uni.showToast({ title: '创建成功', icon: 'success' })
    }
    
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  } catch (error) {
    uni.showToast({ 
      title: isEdit.value ? '保存失败' : '创建失败', 
      icon: 'none' 
    })
  } finally {
    submitting.value = false
    uni.hideLoading()
  }
}
</script>

<style lang="scss" scoped>
.create-character-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
}

.scroll-container {
  flex: 1;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 50rpx 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.avatar-upload {
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 4rpx solid rgba(255, 255, 255, 0.5);
  
  image {
    width: 100%;
    height: 100%;
  }
}

.avatar-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.plus-icon {
  font-size: 60rpx;
  color: #fff;
}

.hint {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 8rpx;
}

.avatar-tip {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 16rpx;
}

.form-section {
  margin: 30rpx;
  padding: 30rpx;
  background-color: #fff;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.form-item {
  margin-bottom: 30rpx;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.label {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  display: block;
  margin-bottom: 16rpx;
}

.required {
  color: #ff4d4f;
}

.input {
  width: 100%;
  height: 88rpx;
  background-color: #f9f9f9;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.picker {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 88rpx;
  background-color: #f9f9f9;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #333;
}

.arrow {
  font-size: 32rpx;
  color: #ccc;
}

.tags-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-height: 88rpx;
  background-color: #f9f9f9;
  border-radius: 12rpx;
  padding: 16rpx;
}

.tag {
  display: flex;
  align-items: center;
  padding: 10rpx 16rpx;
  background-color: rgba(102, 126, 234, 0.1);
  border-radius: 20rpx;
  margin-right: 12rpx;
  margin-bottom: 8rpx;
  
  text {
    font-size: 24rpx;
    color: #667eea;
  }
  
  .remove {
    margin-left: 8rpx;
    font-size: 28rpx;
    color: #999;
  }
}

.tag-input {
  flex: 1;
  min-width: 160rpx;
  height: 56rpx;
  font-size: 28rpx;
  background: transparent;
}

.textarea {
  width: 100%;
  height: 200rpx;
  background-color: #f9f9f9;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  line-height: 1.5;
  box-sizing: border-box;
}

.count {
  display: block;
  text-align: right;
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
}

.ref-images-section {
  margin: 0 30rpx 30rpx;
  padding: 30rpx;
  background-color: #fff;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.images-grid {
  display: flex;
  flex-wrap: wrap;
}

.image-item {
  position: relative;
  width: 200rpx;
  height: 200rpx;
  margin-right: 16rpx;
  margin-bottom: 16rpx;
  
  image {
    width: 100%;
    height: 100%;
    border-radius: 12rpx;
  }
}

.remove-btn {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  width: 40rpx;
  height: 40rpx;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}

.add-image {
  width: 200rpx;
  height: 200rpx;
  background-color: #f9f9f9;
  border: 2rpx dashed #ddd;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  
  .plus {
    font-size: 48rpx;
    color: #ccc;
  }
  
  .text {
    font-size: 24rpx;
    color: #999;
    margin-top: 8rpx;
  }
}

.tip {
  font-size: 24rpx;
  color: #999;
  margin-top: 16rpx;
}

.submit-area {
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background-color: #fff;
  border-top: 1rpx solid #eee;
}

.submit-btn {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 48rpx;
  border: none;
  box-shadow: 0 8rpx 24rpx rgba(102, 126, 234, 0.4);
}
</style>
