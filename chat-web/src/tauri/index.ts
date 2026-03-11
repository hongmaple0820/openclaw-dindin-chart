/**
 * Tauri 桌面端 API 封装
 * 提供系统托盘、窗口控制、系统通知等功能
 */

// 扩展 Window 接口
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

// 检测是否在 Tauri 环境中运行
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined
}

// 窗口控制
export const windowControls = {
  // 最小化窗口
  async minimize() {
    if (!isTauri()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().minimize()
  },

  // 最大化/还原窗口
  async toggleMaximize() {
    if (!isTauri()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    if (await win.isMaximized()) {
      await win.unmaximize()
    } else {
      await win.maximize()
    }
  },

  // 关闭窗口（实际是隐藏到托盘）
  async hide() {
    if (!isTauri()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().hide()
  },

  // 显示窗口
  async show() {
    if (!isTauri()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().show()
    await getCurrentWindow().setFocus()
  },

  // 设置窗口标题
  async setTitle(title) {
    if (!isTauri()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().setTitle(title)
  }
}

// 系统通知
export const notifications = {
  // 发送桌面通知
  async send(title, body, options = {}) {
    if (!isTauri()) {
      // 降级到浏览器通知
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, ...options })
      }
      return
    }
    
    const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification')
    
    let granted = await isPermissionGranted()
    if (!granted) {
      const permission = await requestPermission()
      granted = permission === 'granted'
    }
    
    if (granted) {
      sendNotification({ title, body, ...options })
    }
  },

  // 请求通知权限
  async requestPermission() {
    if (!isTauri()) {
      if ('Notification' in window) {
        return await Notification.requestPermission()
      }
      return 'denied'
    }
    
    const { requestPermission } = await import('@tauri-apps/plugin-notification')
    return await requestPermission()
  },

  // 检查通知权限
  async checkPermission() {
    if (!isTauri()) {
      return 'Notification' in window ? Notification.permission : 'denied'
    }
    
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification')
    return await isPermissionGranted() ? 'granted' : 'denied'
  }
}

// 系统托盘
export const tray = {
  // 监听托盘点击事件
  onClick(callback) {
    if (!isTauri()) return () => {}
    // 托盘事件由 Rust 端处理
    return () => {}
  }
}

// 应用信息
export const appInfo = {
  // 获取应用版本
  async getVersion() {
    if (!isTauri()) return 'web'
    const { getVersion } = await import('@tauri-apps/api/app')
    return await getVersion()
  },

  // 获取应用名称
  async getName() {
    if (!isTauri()) return '枫琳聊天室'
    const { getName } = await import('@tauri-apps/api/app')
    return await getName()
  }
}

export default {
  isTauri,
  window: windowControls,
  notifications,
  tray,
  app: appInfo
}
