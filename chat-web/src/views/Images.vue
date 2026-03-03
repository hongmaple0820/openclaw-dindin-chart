<template>
  <div class="images-page">
    <div class="header">
      <h1>🖼️ 图片管理</h1>
      <div class="header-actions">
        <button @click="loadImages" class="btn-refresh">🔄 刷新</button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon">📷</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">总图片数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-value">{{ formatSize(stats.totalSize) }}</div>
          <div class="stat-label">总大小</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📅</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.today }}</div>
          <div class="stat-label">今日上传</div>
        </div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <select v-model="filters.sender" @change="loadImages">
        <option value="">全部上传者</option>
        <option v-for="s in senders" :key="s" :value="s">{{ s }}</option>
      </select>
      <select v-model="filters.timeRange" @change="applyTimeRange">
        <option value="">全部时间</option>
        <option value="24h">最近24小时</option>
        <option value="7d">最近7天</option>
        <option value="30d">最近30天</option>
      </select>
      <button @click="viewMode = 'grid'" :class="{ active: viewMode === 'grid' }">🔲 网格</button>
      <button @click="viewMode = 'list'" :class="{ active: viewMode === 'list' }">📋 列表</button>
    </div>

    <!-- 图片网格视图 -->
    <div v-if="viewMode === 'grid'" class="image-grid">
      <div v-for="img in images" :key="img.id" class="image-card" @click="showDetail(img)">
        <div class="image-wrapper">
          <img :src="`/api/images/${img.message_id}/${img.id}/thumbnail`" :alt="img.original_name" />
          <div class="image-overlay">
            <button @click.stop="downloadImage(img)" class="overlay-btn">📥</button>
            <button @click.stop="deleteImage(img)" class="overlay-btn danger">🗑️</button>
          </div>
        </div>
        <div class="image-info">
          <div class="image-name">{{ img.original_name }}</div>
          <div class="image-meta">
            <span>{{ formatSize(img.file_size) }}</span>
            <span>{{ img.sender }}</span>
          </div>
          <div class="image-time">{{ relativeTime(img.created_at) }}</div>
        </div>
      </div>
    </div>

    <!-- 图片列表视图 -->
    <div v-else class="image-list">
      <table>
        <thead>
          <tr>
            <th>预览</th>
            <th>文件名</th>
            <th>上传者</th>
            <th>大小</th>
            <th>尺寸</th>
            <th>上传时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="img in images" :key="img.id">
            <td>
              <img 
                :src="`/api/images/${img.message_id}/${img.id}/thumbnail`" 
                class="list-thumbnail"
                @click="showDetail(img)"
              />
            </td>
            <td>{{ img.original_name }}</td>
            <td>{{ img.sender }}</td>
            <td>{{ formatSize(img.file_size) }}</td>
            <td>{{ img.width }} × {{ img.height }}</td>
            <td>{{ formatTime(img.created_at) }}</td>
            <td class="actions">
              <button @click="downloadImage(img)" class="btn-icon">📥</button>
              <button @click="deleteImage(img)" class="btn-icon danger">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="pagination.totalPages > 1">
      <button @click="prevPage" :disabled="pagination.page <= 1">上一页</button>
      <span>{{ pagination.page }} / {{ pagination.totalPages }}</span>
      <button @click="nextPage" :disabled="pagination.page >= pagination.totalPages">下一页</button>
    </div>

    <!-- 图片详情弹窗 -->
    <div v-if="detailImage" class="modal-overlay" @click.self="detailImage = null">
      <div class="modal image-modal">
        <div class="modal-header">
          <h3>图片详情</h3>
          <button @click="detailImage = null" class="close-btn">✕</button>
        </div>
        <div class="modal-body">
          <img :src="`/api/images/${detailImage.message_id}/${detailImage.id}/download`" class="detail-image" />
          <div class="detail-info">
            <div class="info-row">
              <label>文件名:</label>
              <span>{{ detailImage.original_name }}</span>
            </div>
            <div class="info-row">
              <label>上传者:</label>
              <span>{{ detailImage.sender }}</span>
            </div>
            <div class="info-row">
              <label>大小:</label>
              <span>{{ formatSize(detailImage.file_size) }}</span>
            </div>
            <div class="info-row">
              <label>尺寸:</label>
              <span>{{ detailImage.width }} × {{ detailImage.height }}</span>
            </div>
            <div class="info-row">
              <label>上传时间:</label>
              <span>{{ formatTime(detailImage.created_at) }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="downloadImage(detailImage)" class="btn">📥 下载</button>
          <button @click="deleteImage(detailImage); detailImage = null" class="btn btn-danger">🗑️ 删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Images',
  data() {
    return {
      images: [],
      senders: [],
      stats: { total: 0, totalSize: 0, today: 0 },
      filters: { sender: '', timeRange: '' },
      viewMode: 'grid',
      pagination: { page: 1, limit: 24, total: 0, totalPages: 1 },
      detailImage: null
    };
  },
  mounted() {
    this.loadImages();
    this.loadStats();
  },
  methods: {
    async loadImages() {
      try {
        const params = {
          page: this.pagination.page,
          limit: this.pagination.limit,
          sender: this.filters.sender,
          startTime: this.getStartTime()
        };
        
        const res = await fetch(`/api/images/list?${new URLSearchParams(params)}`);
        const data = await res.json();
        
        if (data.success) {
          this.images = data.images || [];
          this.pagination = { ...this.pagination, ...data.pagination };
          this.senders = [...new Set(this.images.map(img => img.sender))];
        }
      } catch (error) {
        console.error('加载图片失败:', error);
      }
    },
    async loadStats() {
      try {
        const res = await fetch('/api/images/stats');
        const data = await res.json();
        if (data.success) {
          this.stats = data.stats;
        }
      } catch (error) {
        console.error('加载统计失败:', error);
      }
    },
    getStartTime() {
      if (!this.filters.timeRange) return null;
      const now = Date.now();
      const ranges = {
        '24h': 86400000,
        '7d': 7 * 86400000,
        '30d': 30 * 86400000
      };
      return now - ranges[this.filters.timeRange];
    },
    applyTimeRange() {
      this.pagination.page = 1;
      this.loadImages();
    },
    showDetail(img) {
      this.detailImage = img;
    },
    downloadImage(img) {
      const url = `/api/images/${img.message_id}/${img.id}/download`;
      const a = document.createElement('a');
      a.href = url;
      a.download = img.original_name;
      a.click();
    },
    async deleteImage(img) {
      if (!confirm(`确定删除图片 ${img.original_name} 吗？`)) return;
      try {
        const res = await fetch(`/api/images/${img.message_id}/${img.id}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          alert('✅ 已删除');
          this.loadImages();
          this.loadStats();
        }
      } catch (error) {
        alert('删除失败: ' + error.message);
      }
    },
    formatSize(bytes) {
      if (!bytes) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = bytes;
      let unitIndex = 0;
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }
      return `${size.toFixed(1)} ${units[unitIndex]}`;
    },
    formatTime(ts) {
      return new Date(ts).toLocaleString('zh-CN');
    },
    relativeTime(ts) {
      const diff = Date.now() - ts;
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return '刚刚';
      if (minutes < 60) return `${minutes}分钟前`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}小时前`;
      const days = Math.floor(hours / 24);
      return `${days}天前`;
    },
    prevPage() {
      if (this.pagination.page > 1) {
        this.pagination.page--;
        this.loadImages();
      }
    },
    nextPage() {
      if (this.pagination.page < this.pagination.totalPages) {
        this.pagination.page++;
        this.loadImages();
      }
    }
  }
};
</script>

<style scoped>
.images-page { padding: 20px; }

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.btn-refresh {
  padding: 10px 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  cursor: pointer;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.stat-icon { font-size: 32px; }
.stat-value { font-size: 24px; font-weight: bold; }
.stat-label { font-size: 14px; color: #666; }

.filter-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.filter-bar select, .filter-bar button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  cursor: pointer;
}

.filter-bar button.active {
  background: #1976d2;
  color: white;
  border-color: #1976d2;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}

.image-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: transform 0.2s;
}

.image-card:hover { transform: translateY(-4px); }

.image-wrapper {
  position: relative;
  padding-top: 75%;
  background: #f5f5f5;
}

.image-wrapper img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-card:hover .image-overlay { opacity: 1; }

.overlay-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 16px;
}

.overlay-btn.danger { background: #ff4d4f; color: white; }

.image-info {
  padding: 12px;
}

.image-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 5px;
}

.image-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

.image-time {
  font-size: 12px;
  color: #999;
}

.image-list table {
  width: 100%;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.image-list th, .image-list td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.image-list th { background: #f5f5f5; font-weight: 500; }

.list-thumbnail {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
}

.actions {
  display: flex;
  gap: 5px;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 5px;
}

.btn-icon.danger { color: #ff4d4f; }

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}

.pagination button:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.image-modal {
  background: white;
  border-radius: 16px;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.detail-image {
  width: 100%;
  border-radius: 8px;
  margin-bottom: 20px;
}

.detail-info { display: flex; flex-direction: column; gap: 10px; }

.info-row {
  display: flex;
  gap: 10px;
}

.info-row label {
  width: 80px;
  color: #666;
  flex-shrink: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid #eee;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: #1976d2;
  color: white;
  cursor: pointer;
}

.btn-danger { background: #ff4d4f; }
</style>
