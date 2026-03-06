/**
 * 媒体前端组件
 */

interface UploadedFile {
  fileId: string;
  originalName: string;
  mediaType: string;
  mimeType: string;
  fileSize: number;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  url: string;
  thumbnailUrl?: string | null;
}

interface MediaData {
  media_type: string;
  media_url: string;
  media_thumbnail_url?: string | null;
  mime_type?: string;
  original_name?: string;
  media_size?: number;
}

declare global {
  interface Window {
    mediaFrontend: MediaFrontend;
  }
}

class MediaFrontend {
  private uploadEndpoint: string;
  private maxFileSize: number;
  private allowedTypes: string[];
  private selectedFiles: File[];

  constructor() {
    this.uploadEndpoint = '/api/files/media/upload';
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/ogg',
      'audio/mp3', 'audio/wav', 'audio/ogg'
    ];
    this.selectedFiles = [];
  }

  /**
   * 初始化媒体上传组件
   */
  initMediaUploader(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with id '${containerId}' not found`);
      return;
    }

    // 创建上传区域
    const uploadArea = document.createElement('div');
    uploadArea.className = 'media-upload-area';
    uploadArea.innerHTML = `
      <div class="upload-zone" id="mediaUploadZone">
        <div class="upload-content">
          <span class="upload-icon">📎</span>
          <p class="upload-text">点击或拖拽上传图片、视频、音频</p>
          <p class="upload-hint">支持 JPG, PNG, GIF, MP4, MP3 等格式，最大50MB</p>
          <input type="file" id="mediaFileInput" accept="image/*,video/*,audio/*" multiple style="display: none;">
          <button id="browseFilesBtn" class="btn btn-secondary">浏览文件</button>
        </div>
      </div>
      <div class="upload-preview" id="mediaPreviewContainer" style="display: none;">
        <!-- Preview items will be added here -->
      </div>
      <div class="upload-controls" id="mediaUploadControls" style="display: none;">
        <button id="cancelUploadBtn" class="btn btn-outline">取消</button>
        <button id="confirmUploadBtn" class="btn btn-primary">发送</button>
      </div>
    `;

    container.appendChild(uploadArea);

    // 绑定事件
    this.bindMediaEvents();
  }

  /**
   * 绑定媒体上传相关事件
   */
  private bindMediaEvents(): void {
    const uploadZone = document.getElementById('mediaUploadZone');
    const fileInput = document.getElementById('mediaFileInput') as HTMLInputElement;
    const browseBtn = document.getElementById('browseFilesBtn');
    const cancelBtn = document.getElementById('cancelUploadBtn');
    const confirmBtn = document.getElementById('confirmUploadBtn');

    if (!uploadZone || !fileInput || !browseBtn || !cancelBtn || !confirmBtn) {
      console.error('Required elements not found');
      return;
    }

    // 点击上传区域打开文件选择器
    uploadZone.addEventListener('click', (e: MouseEvent) => {
      if (e.target !== browseBtn) {
        fileInput.click();
      }
    });

    // 浏览按钮点击
    browseBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      fileInput.click();
    });

    // 文件选择处理
    fileInput.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        this.handleFiles(target.files);
      }
    });

    // 拖拽上传
    uploadZone.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', (e: DragEvent) => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      if (e.dataTransfer) {
        this.handleFiles(e.dataTransfer.files);
      }
    });

    // 取消上传
    cancelBtn.addEventListener('click', () => {
      this.clearUploadPreview();
    });

    // 确认上传
    confirmBtn.addEventListener('click', () => {
      this.uploadSelectedMedia();
    });
  }

  /**
   * 处理选择的文件
   */
  private handleFiles(files: FileList): void {
    const validFiles = Array.from(files).filter(file => {
      if (file.size > this.maxFileSize) {
        alert(`文件 ${file.name} 超过大小限制（50MB）`);
        return false;
      }
      
      if (!this.allowedTypes.includes(file.type)) {
        alert(`文件类型 ${file.type} 不受支持`);
        return false;
      }
      
      return true;
    });

    if (validFiles.length === 0) {
      return;
    }

    this.selectedFiles = validFiles;
    this.showUploadPreview(validFiles);
  }

  /**
   * 显示上传预览
   */
  private showUploadPreview(files: File[]): void {
    const previewContainer = document.getElementById('mediaPreviewContainer');
    const controls = document.getElementById('mediaUploadControls');
    
    if (!previewContainer || !controls) return;
    
    previewContainer.innerHTML = '';
    
    files.forEach((file, index) => {
      const filePreview = this.createFilePreview(file, index);
      previewContainer.appendChild(filePreview);
    });
    
    previewContainer.style.display = 'block';
    controls.style.display = 'flex';
  }

  /**
   * 创建文件预览元素
   */
  private createFilePreview(file: File, index: number): HTMLElement {
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';
    previewItem.dataset.index = String(index);
    
    let previewContent = '';
    
    if (file.type.startsWith('image/')) {
      // 图片预览
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const img = previewItem.querySelector('.preview-thumb') as HTMLImageElement;
        if (img && e.target?.result) img.src = e.target.result as string;
      };
      reader.readAsDataURL(file);
      
      previewContent = `
        <div class="preview-thumb-container">
          <img class="preview-thumb" alt="${file.name}">
        </div>
        <div class="preview-info">
          <div class="preview-name">${file.name}</div>
          <div class="preview-meta">${this.formatFileSize(file.size)}</div>
        </div>
      `;
    } else if (file.type.startsWith('video/')) {
      // 视频预览
      previewContent = `
        <div class="preview-thumb-container">
          <div class="preview-thumb video-thumb">🎥</div>
        </div>
        <div class="preview-info">
          <div class="preview-name">${file.name}</div>
          <div class="preview-meta">${this.formatFileSize(file.size)}</div>
        </div>
      `;
    } else if (file.type.startsWith('audio/')) {
      // 音频预览
      previewContent = `
        <div class="preview-thumb-container">
          <div class="preview-thumb audio-thumb">🎵</div>
        </div>
        <div class="preview-info">
          <div class="preview-name">${file.name}</div>
          <div class="preview-meta">${this.formatFileSize(file.size)}</div>
        </div>
      `;
    } else {
      // 其他文件类型
      previewContent = `
        <div class="preview-thumb-container">
          <div class="preview-thumb file-thumb">📄</div>
        </div>
        <div class="preview-info">
          <div class="preview-name">${file.name}</div>
          <div class="preview-meta">${this.formatFileSize(file.size)}</div>
        </div>
      `;
    }
    
    previewItem.innerHTML = `
      <div class="preview-content">
        ${previewContent}
      </div>
      <button class="remove-btn" data-index="${index}">×</button>
    `;
    
    // 绑定删除按钮事件
    const removeBtn = previewItem.querySelector('.remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        this.removePreview(index);
      });
    }
    
    return previewItem;
  }

  /**
   * 移除预览项
   */
  removePreview(index: number): void {
    const previewItem = document.querySelector(`.preview-item[data-index="${index}"]`);
    if (previewItem) {
      previewItem.remove();
      
      // 从选中文件中移除
      this.selectedFiles = this.selectedFiles.filter((_, i) => i !== index);
      
      // 如果没有预览项了，隐藏容器和控件
      const previewContainer = document.getElementById('mediaPreviewContainer');
      if (previewContainer && previewContainer.children.length === 0) {
        previewContainer.style.display = 'none';
        const controls = document.getElementById('mediaUploadControls');
        if (controls) controls.style.display = 'none';
      }
    }
  }

  /**
   * 清空上传预览
   */
  clearUploadPreview(): void {
    const previewContainer = document.getElementById('mediaPreviewContainer');
    const controls = document.getElementById('mediaUploadControls');
    const fileInput = document.getElementById('mediaFileInput') as HTMLInputElement;
    
    if (previewContainer) {
      previewContainer.innerHTML = '';
      previewContainer.style.display = 'none';
    }
    if (controls) controls.style.display = 'none';
    if (fileInput) fileInput.value = '';
    
    this.selectedFiles = [];
  }

  /**
   * 上传选中的媒体文件
   */
  async uploadSelectedMedia(): Promise<void> {
    const previewItems = document.querySelectorAll('.preview-item');
    const fileInput = document.getElementById('mediaFileInput') as HTMLInputElement;
    
    if (previewItems.length === 0 || this.selectedFiles.length === 0) {
      alert('没有选择任何文件');
      return;
    }

    // 显示上传进度
    this.showUploadProgress();

    try {
      const uploadedFiles: UploadedFile[] = [];
      
      for (const file of this.selectedFiles) {
        const formData = new FormData();
        formData.append('media', file);
        
        const response = await fetch(this.uploadEndpoint, {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          uploadedFiles.push(result.data);
        } else {
          console.error('Upload failed:', result.error);
          alert(`文件 ${file.name} 上传失败: ${result.error}`);
        }
      }
      
      if (uploadedFiles.length > 0) {
        // 发送带媒体的消息
        await this.sendMessageWithMedia(uploadedFiles);
        this.clearUploadPreview();
      }
    } catch (error) {
      const err = error as Error;
      console.error('Upload error:', err);
      alert('上传过程中发生错误: ' + err.message);
    } finally {
      this.hideUploadProgress();
    }
  }

  /**
   * 发送带媒体的消息
   */
  private async sendMessageWithMedia(uploadedFiles: UploadedFile[]): Promise<void> {
    // 这里应该与聊天系统的消息发送逻辑集成
    // 示例：为每个上传的文件创建一条消息
    for (const media of uploadedFiles) {
      const messageContent = `[分享了${media.mediaType}: ${media.originalName}]`;
      
      // 调用聊天系统发送消息的API
      try {
        const response = await fetch('/api/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: messageContent,
            sender: 'WebUser', // 应该从用户会话中获取
            mediaFileId: media.fileId
          })
        });
        
        const result = await response.json();
        if (!result.success) {
          console.error('Send message failed:', result.error);
        }
      } catch (error) {
        console.error('Send message error:', error);
      }
    }
  }

  /**
   * 显示上传进度
   */
  private showUploadProgress(): void {
    // 可以在这里显示进度指示器
    console.log('Uploading media files...');
  }

  /**
   * 隐藏上传进度
   */
  private hideUploadProgress(): void {
    // 可以在这里隐藏进度指示器
    console.log('Upload completed.');
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 渲染媒体消息
   */
  renderMediaMessage(messageElement: HTMLElement, mediaData: MediaData): void {
    let mediaHtml = '';
    
    switch (mediaData.media_type) {
      case 'image':
        mediaHtml = `
          <div class="media-content image-content">
            <img src="${mediaData.media_url}" alt="Shared image" class="shared-image">
            ${mediaData.media_thumbnail_url ? 
              `<img src="${mediaData.media_thumbnail_url}" alt="Thumbnail" class="image-thumbnail">` : ''}
          </div>
        `;
        break;
        
      case 'video':
        mediaHtml = `
          <div class="media-content video-content">
            <video controls class="shared-video">
              <source src="${mediaData.media_url}" type="${mediaData.mime_type}">
              您的浏览器不支持视频播放。
            </video>
          </div>
        `;
        break;
        
      case 'audio':
        mediaHtml = `
          <div class="media-content audio-content">
            <audio controls class="shared-audio">
              <source src="${mediaData.media_url}" type="${mediaData.mime_type}">
              您的浏览器不支持音频播放。
            </audio>
          </div>
        `;
        break;
        
      default:
        mediaHtml = `
          <div class="media-content file-content">
            <div class="file-icon">📄</div>
            <div class="file-info">
              <div class="file-name">${mediaData.original_name || 'Unknown'}</div>
              <div class="file-size">${this.formatFileSize(mediaData.media_size || 0)}</div>
            </div>
          </div>
        `;
    }
    
    messageElement.innerHTML += mediaHtml;
  }
}

// 全局实例
declare global {
  var mediaFrontend: MediaFrontend;
}

if (typeof window !== 'undefined') {
  window.mediaFrontend = new MediaFrontend();
}

export = MediaFrontend;