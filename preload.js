const { ipcRenderer } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const TIME_BLOCKS_KEY = 'timeBlocks';

/**
 * 环境检测和日志管理器
 * 功能：区分开发环境和生产环境，控制日志输出
 * 创建日期：2025-01-16
 * 更新日期：2025-01-16 - 添加文件日志记录功能
 */
class LogManager {
  constructor() {
    this.isDevelopment = this.detectEnvironment();
    this.initFileLogging();
    this.initLogger();
  }

  /**
   * 检测当前运行环境
   * 返回值：boolean - true为开发环境，false为生产环境
   * 创建日期：2025-01-16
   */
  detectEnvironment() {
    try {
      // 方法1: 检查是否存在开发相关文件
      const currentDir = process.cwd();
      const devFiles = ['package.json', 'tsconfig.json', '.git', 'node_modules', 'src'];
      const hasDevFiles = devFiles.some(file => {
        try {
          return fs.existsSync(path.join(currentDir, file));
        } catch (error) {
          return false;
        }
      });

      // 方法2: 检查utools开发者模式（如果可用）
      let isUToolsDevMode = false;
      try {
        if (window.utools && window.utools.isDev) {
          isUToolsDevMode = window.utools.isDev();
        }
      } catch (error) {
        // utools开发者模式检测失败，忽略
      }

      // 方法3: 检查环境变量
      const isNodeEnvDev = process.env.NODE_ENV === 'development';

      // 综合判断：任一条件满足即为开发环境
      const isDev = hasDevFiles || isUToolsDevMode || isNodeEnvDev;
      
      return isDev;
    } catch (error) {
      // 检测失败时默认为生产环境（更安全）
      return false;
    }
  }

  /**
   * 初始化文件日志记录
   * 功能：设置生产环境下的文件日志记录
   * 创建日期：2025-01-16
   */
  initFileLogging() {
    this.logFilePath = null;
    this.maxLogFileSize = 10 * 1024 * 1024; // 10MB
    
    if (!this.isDevelopment) {
      try {
        // 获取用户数据目录
        const userDataPath = window.utools ? window.utools.getPath('userData') : process.cwd();
        this.logFilePath = path.join(userDataPath, 'debug.log');
        
        // 检查日志文件大小，如果超过限制则清空
        this.checkLogFileSize();
      } catch (error) {
        // 文件日志初始化失败，忽略
        this.logFilePath = null;
      }
    }
  }

  /**
   * 检查并管理日志文件大小
   * 功能：防止日志文件过大
   * 创建日期：2025-01-16
   */
  checkLogFileSize() {
    if (!this.logFilePath) return;
    
    try {
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);
        if (stats.size > this.maxLogFileSize) {
          // 文件过大，清空重写
          fs.writeFileSync(this.logFilePath, `[${new Date().toISOString()}] [INFO] 日志文件已清空（超过大小限制）\n`);
        }
      }
    } catch (error) {
      // 文件操作失败，忽略
    }
  }

  /**
   * 写入文件日志
   * 功能：将日志信息写入文件
   * 参数：level - 日志级别，message - 日志消息
   * 创建日期：2025-01-16
   */
  writeToFile(level, ...args) {
    if (!this.logFilePath) return;
    
    try {
      const timestamp = new Date().toISOString();
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      const logEntry = `[${timestamp}] [${level}] ${message}\n`;
      
      fs.appendFileSync(this.logFilePath, logEntry);
    } catch (error) {
      // 文件写入失败，忽略
    }
  }

  /**
   * 初始化日志器
   * 功能：根据环境设置日志输出策略
   * 创建日期：2025-01-16
   * 更新日期：2025-01-16 - 添加文件日志支持和debug方法
   */
  initLogger() {
    // 强制开启所有日志输出到控制台，方便调试
    this.log = (...args) => {
        console.log(...args);
        this.writeToFile('INFO', ...args);
    };
    this.error = (...args) => {
        console.error(...args);
        this.writeToFile('ERROR', ...args);
    };
    this.warn = (...args) => {
        console.warn(...args);
        this.writeToFile('WARN', ...args);
    };
    this.info = (...args) => {
        console.info(...args);
        this.writeToFile('INFO', ...args);
    };
    this.debug = (...args) => {
        console.debug(...args);
        this.writeToFile('DEBUG', ...args);
    };
  }

  /**
   * 获取当前环境信息
   * 返回值：string - 环境描述
   * 创建日期：2025-01-16
   */
  getEnvironmentInfo() {
    return this.isDevelopment ? '开发环境' : '生产环境';
  }

  /**
   * 获取日志文件路径
   * 返回值：string - 日志文件路径，如果未启用文件日志则返回null
   * 创建日期：2025-01-16
   */
  getLogFilePath() {
    return this.logFilePath;
  }
}

// 创建全局日志管理器实例
window.logger = new LogManager();
window.logger.log(`[日志管理器] 当前运行环境: ${window.logger.getEnvironmentInfo()}`);
if (window.logger.getLogFilePath()) {
  window.logger.log(`[日志管理器] 日志文件路径: ${window.logger.getLogFilePath()}`);
}

// 添加插件生命周期日志
window.logger.log(`[插件生命周期] preload.js 开始加载`);

// 初始化存储、主题和头像
function initStorage() {
  // 初始化时间块存储
  if (!window.utools.dbStorage.getItem(TIME_BLOCKS_KEY)) {
    window.utools.dbStorage.setItem(TIME_BLOCKS_KEY, []);
  }
  
  // 初始化全局参数
  let globalSettings = window.utools.dbStorage.getItem('globalSettings');
  if (!globalSettings) {
    globalSettings = {
      preAlertTime: 3,
      preAlertCount: 1,
      globalAlertEnabled: true,
      notificationType: 'popup', // 'popup' - 弹窗通知, 'system' - 系统通知
      floatingOpacity: 0.8 // 悬浮窗透明度
    };
    window.utools.dbStorage.setItem('globalSettings', globalSettings);
  } else {
    // 检查并补全缺失的配置项
    let needUpdate = false;
    if (globalSettings.floatingOpacity === undefined) {
        globalSettings.floatingOpacity = 0.8;
        needUpdate = true;
    }
    if (needUpdate) {
        window.utools.dbStorage.setItem('globalSettings', globalSettings);
    }
  }
  
  // 初始化头像和铃声配置
  if (!window.utools.dbStorage.getItem('globalConfig')) {
    window.utools.dbStorage.setItem('globalConfig', JSON.stringify({ 
      avatar: path.join(window.utools.getPath('userData'), 'touxiang.png'),
      customBellSound: null, // 自定义铃声路径
      bellSoundType: 'default' // 'default' 或 'custom'
    }));
  }
  window.globalConfig = JSON.parse(window.utools.dbStorage.getItem('globalConfig') || '{}');
}

// 初始化UI和主题
function initUIAndTheme() {
  // 更新UI显示
  const settings = window.utools.dbStorage.getItem('globalSettings');
  const preAlertTimeInput = document.getElementById('pre-alert-time');
  const preAlertCountInput = document.getElementById('pre-alert-count');
  const globalAlertToggle = document.getElementById('global-alert-toggle');
  if (preAlertTimeInput && preAlertCountInput && globalAlertToggle) {
    preAlertTimeInput.value = settings.preAlertTime;
    preAlertCountInput.value = settings.preAlertCount;
    globalAlertToggle.value = settings.globalAlertEnabled ? 'true' : 'false';

    // 初始化悬浮窗透明度滑块
    const floatingOpacityInput = document.getElementById('floating-opacity');
    const opacityValueDisplay = document.getElementById('opacity-value');
    if (floatingOpacityInput && opacityValueDisplay) {
        const opacity = settings.floatingOpacity !== undefined ? settings.floatingOpacity : 0.8;
        floatingOpacityInput.value = opacity;
        opacityValueDisplay.textContent = opacity;
    }
  }
  
  
  // 初始化铃声UI显示
  setTimeout(() => {
    updateBellSoundUI();
  }, 100);
  
  // 设置初始主题
  const isDarkMode = window.utools.isDarkColors();
  document.documentElement.setAttribute('theme', isDarkMode ? 'dark' : 'light');
  
  // 每次插件进入时统一处理主题同步、窗口显示和时间线渲染
  window.utools.onPluginEnter(({ code, type, payload }) => {
    window.logger.log(`[插件生命周期] onPluginEnter 触发 - code: ${code}, type: ${type}`);
    
    // 确保app元素可见（修复切换插件后界面无法显示的问题）
    const appElement = document.getElementById('app');
    if (appElement) {
      const currentDisplay = appElement.style.display;
      window.logger.log(`[插件生命周期] app元素当前display状态: ${currentDisplay || 'default'}`);
      appElement.style.display = 'block';
      window.logger.log(`[插件生命周期] app元素display已设置为: block`);
    } else {
      window.logger.error(`[插件生命周期] 未找到app元素`);
    }
    
    // 同步主题
    const currentIsDarkMode = window.utools.isDarkColors();
    document.documentElement.setAttribute('theme', currentIsDarkMode ? 'dark' : 'light');
    
    // 显示窗口
    if (window.utools.showMainWindow) {
      window.utools.showMainWindow();
    }
    
    // 渲染时间线
    if (typeof window.renderTimeline === 'function') {
      setTimeout(() => {
        window.renderTimeline();
      }, 100);
    }
    // 若悬浮窗应为可见状态，确保打开并同步数据
    let st = null;
    try {
      st = getFloatingState();
      if (st && st.visible) {
        window.logger.log('[插件生命周期] onPluginEnter: 检测到悬浮窗应为开启状态，尝试打开');
        window.openFloatingWindow();
      }
    } catch (_) {}

    // 更新悬浮窗按钮文本为正确状态
    try {
      const btn = document.getElementById('floating-toggle-btn');
      if (btn) btn.textContent = st && st.visible ? '隐藏悬浮窗' : '显示悬浮窗';
    } catch (_) {}

    window.logger.log(`[插件生命周期] onPluginEnter 处理完成`);
  });
}

// 在插件加载时初始化存储
initStorage();

// 在DOM加载完成后初始化UI和主题
document.addEventListener('DOMContentLoaded', () => {
  window.logger.log(`[插件生命周期] DOM加载完成，开始初始化应用`);
  initUIAndTheme();
  // 显示主窗口
  const appElement = document.getElementById('app');
  if (appElement) {
    appElement.style.display = 'block';
  }
  window.logger.log(`[插件生命周期] 应用初始化完成`);
});

/*
 * 功能：设置页悬浮窗显示/隐藏切换并更新按钮文案
 * 参数：无
 * 返回值：无
 * 创建日期：2025-12-01
 */


// 时间块管理
window.saveTimeSettings = (blocks) => {
  // 确保每个时间块都有唯一ID、创建时间、状态和预提醒设置
  const updatedBlocks = blocks.map(block => ({
    ...block,
    id: block.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
    createdAt: block.createdAt || Date.now(),
    status: block.status || 'pending',
    preAlert: block.preAlert !== undefined ? block.preAlert : false,
    // 为已存在的时间块设置默认提醒次数（永久提醒）
    reminderCount: block.reminderCount !== undefined ? block.reminderCount : -1,
    remainingCount: block.remainingCount !== undefined ? block.remainingCount : (block.reminderCount !== undefined ? block.reminderCount : -1)
  }));
  window.utools.dbStorage.setItem(TIME_BLOCKS_KEY, updatedBlocks);
  //window.alertManager.updateTimeBlocks();
  try {
    const st = getFloatingState();
    if (st && st.visible) window.pushFloatingData();
  } catch (_) {}
};

window.getTimeSettings = () => {
  return window.utools.dbStorage.getItem(TIME_BLOCKS_KEY) || [];
};

window.deleteTimeBlock = (id) => {
  const blocks = window.getTimeSettings();
  const updatedBlocks = blocks.filter(block => block.id !== id);
  window.saveTimeSettings(updatedBlocks);
  // 只重置被删除时间块的状态
  lastPreAlertTimes.delete(id);
  lastRemainingMinutes.delete(id);
  lastAlertDates.delete(id);
  lastNotificationTimes.delete(id);
  try {
    const st = getFloatingState();
    if (st && st.visible) window.pushFloatingData();
  } catch (_) {}
};

window.updateTimeBlock = (id, updatedData) => {
  const blocks = window.getTimeSettings();
  const index = blocks.findIndex(block => block.id === id);
  if (index !== -1) {
    // 保持原有的id和创建时间
    const originalBlock = blocks[index];
    blocks[index] = { 
      ...originalBlock,
      ...updatedData,
      id: originalBlock.id,
      createdAt: originalBlock.createdAt
    };
    
    // 重置预提醒相关状态
    lastPreAlertTimes.delete(id);
    lastRemainingMinutes.delete(id);
    lastAlertDates.delete(id);
    lastNotificationTimes.delete(id);
    
    window.saveTimeSettings(blocks);
    return true;
  }
  return false;
};



// 音频播放功能
window.playBellSound = () => {
  try {
    const config = JSON.parse(window.utools.dbStorage.getItem('globalConfig') || '{}');
    const bellSoundType = config.bellSoundType || 'default';
    const customBellSound = config.customBellSound;
    
    if (bellSoundType === 'custom' && customBellSound) {
      // 播放自定义铃声
      window.logger.log('[音频] 播放自定义铃声:', customBellSound);
      const audio = new Audio();
      audio.src = `file:///${customBellSound.replace(/\\/g, '/')}`;
      audio.volume = 0.7;
      audio.play().catch(error => {
        window.logger.error('[音频] 自定义铃声播放失败，回退到默认铃声:', error);
        playDefaultBellSound();
      });
    } else {
      // 播放默认铃声
      playDefaultBellSound();
    }
  } catch (error) {
    window.logger.error('[音频] 播放铃声失败:', error);
    playDefaultBellSound();
  }
};

// 默认铃声播放函数
function playDefaultBellSound() {
  try {
    // 创建音频上下文
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // 创建振荡器
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // 连接节点
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 设置铃声参数 - 增加持续时间和音效
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // 800Hz频率
    oscillator.frequency.linearRampToValueAtTime(1000, audioContext.currentTime + 0.3);
    oscillator.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 0.6);
    oscillator.frequency.linearRampToValueAtTime(1200, audioContext.currentTime + 1.2);
    oscillator.type = 'sine'; // 正弦波
    
    // 设置音量包络（渐强渐弱效果）- 延长时间
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.8);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);
    
    // 播放铃声 - 延长到1.5秒
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 1.5);
    
    window.logger.log('[音频] 播放默认铃声');
  } catch (error) {
      window.logger.error('[音频] 默认铃声播放失败:', error);
    }
}

// 通知系统

// 轻量级Toast提示（不隐藏界面）
window.showToast = (message, type = 'success') => {
  window.logger.log(`[Toast提示] 消息: ${message}, 类型: ${type}`);
  
  const toast = document.getElementById('toast-notification');
  const toastMessage = document.getElementById('toast-message');
  const toastIcon = document.querySelector('.toast-icon');
  
  if (!toast || !toastMessage || !toastIcon) {
    window.logger.warn('[Toast提示] 找不到Toast元素，回退到console输出');
    return;
  }
  
  // 设置消息内容
  toastMessage.textContent = message;
  
  // 设置图标和样式
  if (type === 'error') {
    toastIcon.textContent = '✗';
    toastIcon.className = 'toast-icon error';
  } else {
    toastIcon.textContent = '✓';
    toastIcon.className = 'toast-icon';
  }
  
  // 显示Toast
  toast.classList.add('show');
  
  // 3秒后自动隐藏
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
};

// 系统通知功能（已停用，保留代码以备将来使用）
window.sendSystemNotification = (title, body) => {
  window.logger.log(`[系统通知] 标题: ${title}, 内容: ${body}`);
  
  // 使用utools原生通知API
  if (window.utools.showNotification) {
    window.utools.showNotification({
      title: title,
      body: body,
      icon: window.getGlobalAvatar() || './logo.png'
    });
  } else {
    window.logger.warn('[系统通知] utools原生通知API不可用，回退到弹窗通知');
    window.sendPopupNotification(title, body);
  }
};

// 弹窗通知（原有的通知系统）
window.sendPopupNotification = (title, body) => {
  window.logger.log(`[弹窗通知] 标题: ${title}, 内容: ${body}`);
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  
  // 创建通知窗口
  const notificationPath = './notification.html';
  const win = window.utools.createBrowserWindow(notificationPath, {
    width: 400,
    height: 200,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  }, () => {
    // 预处理通知内容
    const safeTitle = String(title).replace(/[\\"']/g, '');
    const safeBody = String(body).replace(/[\\"']/g, '');
    const avatarUrl11 = window.getGlobalAvatar();
    const rawAvatarPath = window.getGlobalAvatar();
    //const encodedAvatarPath = encodeURIComponent(rawAvatarPath.replace(/\\/g, '/'));
    encodedAvatarPath = rawAvatarPath.replace(/\\/g, '/');
    const avatarUrl = `file:///${encodedAvatarPath}?t=${new Date().getTime()}`;
    window.logger.log('[通知] 处理后的头像URL:', avatarUrl);
    // 显示窗口并设置置顶
    win.show();
    win.setAlwaysOnTop(true);

    // 通过executeJavaScript注入通知内容
    win.webContents.executeJavaScript(`
      document.querySelector('.title').textContent = "${safeTitle}";
      document.querySelector('.content').textContent = "${safeBody}";
      document.querySelector('.avatar-container').style.backgroundImage = "url('${avatarUrl}')";
    `);

  // 更新alertManager的updateTimeBlocks方法
  /*
  if (window.alertManager) {
    window.alertManager.updateTimeBlocks = function() {
      this.timeBlocks = window.getTimeSettings();
      this.currentBlock = this.timeBlocks.find(b => b.status === 'active');
      this.currentAvatar = window.getGlobalAvatar() || './logo.svg';
    };
  }*/

  // 监听子窗口发送的消息
  win.on('message', (message) => {
    if (message.type === 'close-notification') {
      window.logger.log('[通知窗口] 收到关闭消息，准备关闭窗口');
      if (win && !win.isDestroyed()) {
        window.logger.log('[通知窗口] 窗口未被销毁，执行关闭操作');
        win.close();
      } else {
        window.logger.log('[通知窗口] 窗口已被销毁，跳过关闭操作');
      }
    }
  });

  win.setPosition(
    Math.floor((window.screen.width - 400) / 2),
    Math.floor((window.screen.height - 200) / 2)
  );
}
)};

// 统一的提醒发送接口（固定使用弹窗通知）
window.sendNotification = (title, body) => {
  // 闹钟功能固定使用弹窗通知，确保强制提醒
  window.sendPopupNotification(title, body);
};

// 悬浮窗运行态标记
if (typeof window.__floatingVisible === 'undefined') window.__floatingVisible = false;
if (typeof window.__floatingOpening === 'undefined') window.__floatingOpening = false;
if (typeof window.__floatingWindows === 'undefined') window.__floatingWindows = [];

// 监听来自悬浮窗的操作请求（如移动窗口）
ipcRenderer.on('widget-action', (event, action) => {
    if (!window.floatingWin || window.floatingWin.isDestroyed()) {
        return;
    }

    try {
        if (action.type === 'move') {
            const { x, y } = action;
            window.floatingWin.setPosition(Math.round(x), Math.round(y));
        }
    } catch (e) {
        // 忽略移动过程中的异常，避免影响主流程
    }
});

// 监听来自悬浮窗的通用消息（使用 utools 官方窗口通信通道）
ipcRenderer.on('widget-message', (event, message) => {
    try {
        if (!message) return;
        if (message.type === 'close-floating') {
            // 悬浮窗内部请求关闭，统一走主窗口关闭逻辑，确保状态持久化
            if (typeof window.closeFloatingWindow === 'function') {
                window.closeFloatingWindow();
            }
        }
    } catch (_) {}
});

/*
 * 功能：处理悬浮窗透明度变更
 * 参数：value - 透明度值 (0.1 - 1.0)
 * 创建日期：2025-12-05
 */
window.handleFloatingOpacityChange = (value) => {
    const settings = window.utools.dbStorage.getItem('globalSettings') || {};
    const opacity = parseFloat(value);
    settings.floatingOpacity = opacity;
    window.utools.dbStorage.setItem('globalSettings', settings);
    
    // 实时更新悬浮窗透明度 - 通过 IPC 发送给页面 CSS 控制
    // 避免直接使用 win.setOpacity 导致 Windows 下透明窗口渲染问题
    if (window.floatingWin && !window.floatingWin.isDestroyed()) {
        // window.floatingWin.setOpacity(opacity); // 禁用原生方法
        ipcRenderer.sendTo(window.floatingWin.webContents.id, 'widget-message', {
            type: 'update-opacity',
            value: opacity
        });
    }
};

/*
 * 功能：创建并显示悬浮窗
 * 参数：无
 * 返回值：BrowserWindow 实例或 null
 * 创建日期：2025-12-01
 * 更新日期：2025-12-16 简化实现，提升稳定性
 */
window.openFloatingWindow = () => {
  try {
    // 避免并发创建
    if (window.__floatingOpening) {
      try { window.logger.log('[悬浮窗] open: 正在创建中，忽略本次调用'); } catch (_) {}
      return window.floatingWin || null;
    }

    // 已有窗口时，直接唤醒并纠正位置/层级
    if (window.floatingWin && !window.floatingWin.isDestroyed()) {
      try { window.logger.log('[悬浮窗] open: 已存在窗口，执行唤醒'); } catch (_) {}

      try {
        const st = getFloatingState();
        if (st && typeof st.x === 'number' && typeof st.y === 'number') {
          try {
            const width = 300;
            const height = 45;
            const screenWidth = (window.screen && window.screen.width) || 1920;
            const screenHeight = (window.screen && window.screen.height) || 1080;
            let nx = st.x;
            let ny = st.y;

            // 若上次位置超出当前屏幕范围，则回退到居中位置，避免“看不见但已存在”
            if (
              typeof nx !== 'number' || typeof ny !== 'number' ||
              nx < -width || nx > screenWidth - 20 ||
              ny < -height || ny > screenHeight - 20
            ) {
              nx = Math.floor((screenWidth - width) / 2);
              ny = Math.floor((screenHeight - height) / 2);
            }

            window.floatingWin.setPosition(nx, ny);
          } catch (_) {}
        }

        // 显示窗口
        if (window.floatingWin.showInactive) {
          window.floatingWin.showInactive();
        } else {
          window.floatingWin.show();
        }

        // 轻量兜底：延时再次置顶和可见性校正
        setTimeout(() => {
          try {
            if (!window.floatingWin || window.floatingWin.isDestroyed()) return;
            window.floatingWin.setAlwaysOnTop(true);

            const settings = window.utools.dbStorage.getItem('globalSettings') || {};
            let opacity = parseFloat(settings.floatingOpacity);
            if (isNaN(opacity)) opacity = 0.8;

            if (window.floatingWin.webContents) {
              try {
                ipcRenderer.sendTo(window.floatingWin.webContents.id, 'widget-message', {
                  type: 'update-opacity',
                  value: opacity
                });
              } catch (_) {}
            }

            if (typeof window.floatingWin.isVisible === 'function' && !window.floatingWin.isVisible()) {
              window.floatingWin.show();
            }
          } catch (_) {}
        }, 100);
      } catch (e) {
        try { window.logger.error('[悬浮窗] open: 唤醒现有窗口失败', e); } catch (_) {}
      }

      persistFloatingState({ visible: true });
      window.__floatingVisible = true;
      try { const btn = document.getElementById('floating-toggle-btn'); if (btn) btn.textContent = '隐藏悬浮窗'; } catch (_) {}
      return window.floatingWin;
    }

    // 创建新窗口
    try { window.logger.log('[悬浮窗] open: 开始创建新窗口'); } catch (_) {}
    window.__floatingOpening = true;

    const state = getFloatingState();
    const settings = window.utools.dbStorage.getItem('globalSettings') || {};
    let opacity = parseFloat(settings.floatingOpacity);
    if (isNaN(opacity)) opacity = 0.8;
    opacity = Math.max(0.1, Math.min(1.0, opacity));

    const floatingPath = `./floating.html?opacity=${opacity}`;
    try { window.logger.log(`[悬浮窗] open: 准备创建，透明度=${opacity}`); } catch (_) {}

    const win = window.utools.createBrowserWindow(floatingPath, {
      width: 300,
      height: 45,
      frame: false,
      resizable: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      useContentSize: true,
      thickFrame: false,
      hasShadow: false,
      webPreferences: {
        preload: 'floating_preload.js',
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
        backgroundThrottling: false
      }
    }, () => {
      try {
        if (!win) {
          try { window.logger.error('[悬浮窗] open: 回调时窗口对象为空'); } catch (_) {}
          return;
        }

        const showWindow = () => {
          if (!win || win.isDestroyed()) return;
          try {
            // 位置恢复或居中
            const width = 300;
            const height = 45;
            const screenWidth = (window.screen && window.screen.width) || 1920;
            const screenHeight = (window.screen && window.screen.height) || 1080;

            let nx = null;
            let ny = null;

            if (state && typeof state.x === 'number' && typeof state.y === 'number') {
              nx = state.x;
              ny = state.y;
            }

            // 如果无历史位置或历史位置已超出当前屏幕范围，自动居中
            if (
              typeof nx !== 'number' || typeof ny !== 'number' ||
              nx < -width || nx > screenWidth - 20 ||
              ny < -height || ny > screenHeight - 20
            ) {
              nx = Math.floor((screenWidth - width) / 2);
              ny = Math.floor((screenHeight - height) / 2);
            }

            try { win.setPosition(nx, ny); } catch (_) {}

            // 确保缩放比例正常
            try { win.webContents && win.webContents.setZoomFactor(1.0); } catch (_) {}

            // 显示窗口
            setTimeout(() => {
              if (!win || win.isDestroyed()) return;
              if (win.showInactive) {
                win.showInactive();
              } else {
                win.show();
              }
              try { win.setAlwaysOnTop(true); } catch (_) {}
              try { window.logger.log(`[悬浮窗] open: 新窗口已显示，透明度=${opacity}`); } catch (_) {}
            }, 100);
          } catch (e) {
            try { window.logger.error('[悬浮窗] open: 显示新窗口失败', e); } catch (_) {}
          }
        };

        if (win.once) {
          win.once('ready-to-show', showWindow);
          setTimeout(() => {
            try {
              if (win && !win.isDestroyed() && !win.isVisible()) {
                try { window.logger.log('[悬浮窗] open: ready-to-show 超时，强制显示'); } catch (_) {}
                showWindow();
              }
            } catch (_) {}
          }, 500);
        } else {
          showWindow();
        }

        try { window.pushFloatingData(); } catch (_) {}
        persistFloatingState({ visible: true });
        window.__floatingVisible = true;
        try {
          const btn = document.getElementById('floating-toggle-btn');
          if (btn) btn.textContent = '隐藏悬浮窗';
        } catch (_) {}

        // 建立与悬浮窗的通信
        setTimeout(() => {
          try {
            if (win && !win.isDestroyed() && win.webContents) {
              ipcRenderer.sendTo(win.webContents.id, 'widget-message', 'connect');
            }
          } catch (_) {}
        }, 500);

        try { window.logger.log('[悬浮窗] open: 新窗口创建完成'); } catch (_) {}
      } finally {
        window.__floatingOpening = false;
      }
    });

    // 绑定移动、关闭事件（简单版本）
    try {
      if (typeof win.on === 'function') {
        win.on('message', (message) => {
          try {
            if (message && message.type === 'close-floating') {
              window.closeFloatingWindow();
            } else if (message && message.type === 'widget-action' && message.payload && message.payload.type === 'move') {
              const { x, y } = message.payload;
              try {
                win.setBounds({
                  x: Math.round(x),
                  y: Math.round(y),
                  width: 300,
                  height: 45
                });
              } catch (_) {}
            }
          } catch (_) {}
        });

        win.on('move', () => {
          try {
            const [x, y] = win.getPosition();
            persistFloatingState({ x, y });
          } catch (_) {}
        });

        win.on('closed', () => {
          try { window.logger.log('[悬浮窗] onClosed: 触发'); } catch (_) {}
          window.floatingWin = null;
          window.__floatingVisible = false;
          try { window.__floatingWindows = (window.__floatingWindows || []).filter(w => w !== win); } catch (_) {}
        });
      } else {
        try { window.logger.log('[悬浮窗] open: win.on 不可用，将依赖全局 IPC'); } catch (_) {}
      }
    } catch (e) {
      try { window.logger.error('[悬浮窗] open: 绑定窗口事件失败', e); } catch (_) {}
    }

    window.floatingWin = win;
    try {
      window.__floatingWindows.push(win);
      if (window.logger && window.logger.log) window.logger.log(`[悬浮窗] open: 注册实例，当前数量 ${window.__floatingWindows.length}`);
    } catch (_) {}

    return win;
  } catch (e) {
    window.__floatingOpening = false;
    try { console.error('[Main] 创建悬浮窗失败', e); } catch (_) {}
    return null;
  }
};

/*
 * 功能：关闭悬浮窗并停止更新
 * 参数：无
 * 返回值：Boolean 是否成功
 * 创建日期：2025-12-01
 */
window.closeFloatingWindow = () => {
  try {
    if (window.logger && window.logger.log) window.logger.log('[悬浮窗] close: 开始关闭');
    stopFloatingUpdateTimer();
    try { window.utools && window.utools.dbStorage && window.utools.dbStorage.setItem('__floating_close_signal', String(Date.now())); } catch (_) {}
    try { window.broadcastCloseFloatingWindows(); } catch (_) {}
    
    // 尝试通过 ID 关闭可能存在的孤儿窗口
    try {
        const orphanId = localStorage.getItem('floating_window_id');
        if (orphanId) {
             const id = parseInt(orphanId);
             if (!isNaN(id)) ipcRenderer.sendTo(id, 'force-close');
             localStorage.removeItem('floating_window_id');
        }
    } catch (_) {}

    const wins = Array.from(window.__floatingWindows || []).concat(window.floatingWin ? [window.floatingWin] : []);
    if (window.logger && window.logger.log) window.logger.log(`[悬浮窗] close: 兜底关闭，实例数=${wins.length}`);
    wins.forEach((w, idx) => {
      if (!w) return;
      // 定义忽略 "window no exist" 错误的辅助函数
      const safeExec = (fn, name) => {
          try {
              fn();
          } catch (e) {
              const msg = String(e);
              if (msg.includes('window no exist') || msg.includes('Object has been destroyed')) {
                  // 窗口已销毁，忽略此类错误
                  return;
              }
              try { window.logger.error(`[悬浮窗] ${name}失败 -> #${idx}`, e); } catch (_) {}
          }
      };

      safeExec(() => w.hide && w.hide(), 'hide');
      safeExec(() => w.close && w.close(), 'close');
      safeExec(() => w.destroy && w.destroy(), 'destroy');
    });
  } catch (_) {}
  window.floatingWin = null;
  try { window.__floatingWindows = []; } catch (_) {}
  persistFloatingState({ visible: false });
  window.__floatingVisible = false;
  try { const btn = document.getElementById('floating-toggle-btn'); if (btn) btn.textContent = '显示悬浮窗'; } catch (_) {}
  try { window.logger.log('[悬浮窗] close: 完成'); } catch (_) {}
  return true;
};

/*
 * 功能：切换悬浮窗显示/隐藏状态
 * 参数：无
 * 返回值：Boolean 当前是否可见
 * 创建日期：2025-12-01
 */
window.toggleFloatingWindow = () => {
  const windowExists = window.floatingWin && !window.floatingWin.isDestroyed();
  let windowVisible = false;

  if (windowExists && typeof window.floatingWin.isVisible === 'function') {
    try {
      windowVisible = window.floatingWin.isVisible();
    } catch (_) {
      windowVisible = false;
    }
  }

  if (windowExists && windowVisible) {
    try { window.logger.log(`[悬浮窗] toggle: 执行隐藏 visible=${window.__floatingVisible}, exists=${windowExists}, isVisible=${windowVisible}`); } catch (_) {}
    window.closeFloatingWindow();
    return false;
  } else {
    try { window.logger.log(`[悬浮窗] toggle: 执行显示 visible=${window.__floatingVisible}, exists=${windowExists}, isVisible=${windowVisible}`); } catch (_) {}
    window.openFloatingWindow();
    return true;
  }
};

/*
 * 功能：推送数据到悬浮窗页面
 * 参数：无
 * 返回值：无
 * 创建日期：2025-12-01
 */
window.pushFloatingData = () => {
  try {
    // 无论窗口是否打开，都更新 localStorage 数据，以便悬浮窗独立读取
    const snapshot = getTimelineSnapshot();
    const alarms = snapshot.blocks.map(b => ({
      id: b.id,
      name: b.task,
      timeText: b.timeStr,
      remainText: b.remainText || '',
      enabled: b.enabled,
      statusText: b.statusText,
      isCurrent: !!b.isCurrent
    }));
    const payload = { alarms, currentTaskName: snapshot.currentTaskBlock ? snapshot.currentTaskBlock.task : '' };
    
    try {
        localStorage.setItem('floating_task_data', JSON.stringify(payload));
    } catch (_) {}

    if (!window.floatingWin || window.floatingWin.isDestroyed()) return;

    try { if (window.logger && window.logger.log) window.logger.log(`[悬浮窗] push: count=${alarms.length}, current=${payload.currentTaskName || '无'}`); } catch (_) {}
    
    // IPC 发送
    if (window.floatingWin && window.floatingWin.webContents) {
         // console.log(`[Main] 推送数据到悬浮窗 (ID: ${window.floatingWin.webContents.id})`);
         ipcRenderer.sendTo(window.floatingWin.webContents.id, 'widget-message', payload);
    }
  } catch (_) {}
};

/*
 * 功能：广播关闭消息到所有悬浮窗实例
 * 参数：无
 * 返回值：无
 * 创建日期：2025-12-01
 */
window.broadcastCloseFloatingWindows = () => {
  try {
    const wins = (window.__floatingWindows || []).slice();
    if (window.logger && window.logger.log) window.logger.log(`[悬浮窗] 广播关闭，实例数=${wins.length}`);
    wins.forEach((w, idx) => {
      try {
        if (window.logger && window.logger.log) window.logger.log(`[悬浮窗] 广播关闭 -> 实例#${idx}`);
        w?.webContents?.executeJavaScript("window.utools.sendToParent({type:'close-floating'})");
      } catch (err) {
        if (window.logger && window.logger.error) window.logger.error(`[悬浮窗] 广播关闭失败 -> 实例#${idx}`, err);
      }
    });
  } catch (_) {}
};

/*
 * 功能：计算当前活跃闹钟数据用于悬浮窗展示
 * 参数：无
 * 返回值：Array<{id,name,timeText,remainText,enabled}>
 * 创建日期：2025-12-01
 */
/*
 * 功能：生成与时间轴视图一致的数据快照
 * 参数：无
 * 返回值：{ nowMinutes, currentTaskBlock, nextTaskBlock, blocks: Array }
 * 创建日期：2025-12-01
 */
function getTimelineSnapshot() {
  const settings = window.utools.dbStorage.getItem('globalSettings') || { globalAlertEnabled: true };
  const blocks = window.getTimeSettings();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();

  const enabledTodayBlocks = blocks.filter(b => {
    if (!b) return false;
    const enabled = (b.enabled === true) || (typeof b.enabled === 'string' && b.enabled.toLowerCase() === 'true');
    if (!enabled) return false;
    const mode = b.reminderMode || 'daily';
    if (mode === 'weekly') {
      const weekdays = b.weekdays || [];
      return weekdays.includes(today);
    }
    if (mode === 'once') {
      const taskDate = new Date(b.startTime);
      const nowDate = new Date();
      return taskDate.getDate() === nowDate.getDate() &&
             taskDate.getMonth() === nowDate.getMonth() &&
             taskDate.getFullYear() === nowDate.getFullYear();
    }
    return true;
  });

  const pastBlocks = enabledTodayBlocks.filter(b => {
    const t = new Date(b.startTime);
    const m = t.getHours() * 60 + t.getMinutes();
    return m <= nowMinutes;
  });

  let currentTaskBlock = null;
  if (pastBlocks.length > 0) {
    currentTaskBlock = pastBlocks.reduce((latest, current) => {
      const lm = new Date(latest.startTime);
      const cm = new Date(current.startTime);
      const lmin = lm.getHours() * 60 + lm.getMinutes();
      const cmin = cm.getHours() * 60 + cm.getMinutes();
      return cmin > lmin ? current : latest;
    });
  }

  const futureBlocks = enabledTodayBlocks.filter(b => {
    const tm = new Date(b.startTime);
    const mins = tm.getHours() * 60 + tm.getMinutes();
    return mins > nowMinutes;
  });
  let nextTaskBlock = null;
  if (futureBlocks.length > 0) {
    nextTaskBlock = futureBlocks.reduce((earliest, current) => {
      const em = new Date(earliest.startTime);
      const cm = new Date(current.startTime);
      const emin = em.getHours() * 60 + em.getMinutes();
      const cmin = cm.getHours() * 60 + cm.getMinutes();
      return cmin < emin ? current : earliest;
    });
  }

  const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const normalized = blocks.map(block => {
    const date = new Date(block.startTime);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    const reminderCount = block.reminderCount !== undefined ? block.reminderCount : -1;
    const remainingCount = block.remainingCount !== undefined ? block.remainingCount : reminderCount;
    const reminderText = reminderCount === -1 ? '永久' : `剩余${remainingCount}次`;
    const mode = block.reminderMode || 'daily';
    let modeText = '每日';
    if (mode === 'weekly') {
      const weekdays = block.weekdays || [];
      const selected = weekdays.map(d => weekNames[d]).join('、');
      modeText = `每周(${selected})`;
    } else if (mode === 'once') {
      modeText = '单次';
    }
    const isCurrent = currentTaskBlock && currentTaskBlock.id === block.id;
    const statusText = `${(block.enabled ? '已启用' : '已禁用')} | 预提醒：${(block.preAlert ? '已启用' : '已禁用')} | 提醒：${reminderText} | 模式：${modeText}`;
    let remainText = '';
    const startMinutes = date.getHours() * 60 + date.getMinutes();
    const diff = startMinutes - nowMinutes;
    if (diff >= 0) remainText = `还有 ${diff} 分钟`;

    return {
      id: block.id,
      task: block.task || block.id,
      timeStr,
      enabled: settings.globalAlertEnabled !== false && block.enabled !== false,
      preAlert: !!block.preAlert,
      reminderText,
      modeText,
      statusText,
      isCurrent,
      remainText,
      sortKey: startMinutes
    };
  }).sort((a, b) => a.sortKey - b.sortKey);

  // try { if (window.logger && window.logger.log) window.logger.log(`[悬浮窗] snapshot: now=${now.getHours()}:${now.getMinutes()}, enabledToday=${enabledTodayBlocks.length}, past=${pastBlocks.length}, future=${futureBlocks.length}, current=${currentTaskBlock ? currentTaskBlock.task : '无'}`); } catch (_) {}
  return { nowMinutes, currentTaskBlock, nextTaskBlock, blocks: normalized };
}

/*
 * 功能：启动悬浮窗内容更新定时器（已废弃，跟随主循环）
 */
function startFloatingUpdateTimer() {
  // if (window.floatingTimer) return;
  // window.floatingTimer = setInterval(() => {
  //   window.pushFloatingData();
  // }, 500);
}

/*
 * 功能：将当前任务快照写入桌面微件数据文件
 * 参数：无
 * 返回值：无
 * 创建日期：2025-12-01
 */
function writeWidgetData() {
  try {
    const os = require('os')
    const path = require('path')
    const fs = require('fs')
    const dir = path.join(os.homedir(), 'DeskClock')
    try { fs.mkdirSync(dir, { recursive: true }) } catch (_) {}
    const snap = getTimelineSnapshot()
    const current = snap.currentTaskBlock ? {
      name: snap.currentTaskBlock.task,
      hhmm: new Date(snap.currentTaskBlock.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      elapsed: Math.max(0, (snap.nowMinutes - (new Date(snap.currentTaskBlock.startTime).getHours()*60 + new Date(snap.currentTaskBlock.startTime).getMinutes())))
    } : null
    const next = snap.nextTaskBlock ? {
      name: snap.nextTaskBlock.task,
      hhmm: new Date(snap.nextTaskBlock.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      remaining: Math.max(0, ((new Date(snap.nextTaskBlock.startTime).getHours()*60 + new Date(snap.nextTaskBlock.startTime).getMinutes()) - snap.nowMinutes))
    } : null
    const payload = { current, next, updatedAt: Date.now() }
    fs.writeFileSync(path.join(dir, 'current_task.json'), JSON.stringify(payload))
  } catch (_) {}
}

// 已移除：桌面微件数据同步定时器

/*
 * 功能：停止悬浮窗内容更新定时器（已废弃）
 */
function stopFloatingUpdateTimer() {
  // if (window.floatingTimer) {
  //   clearInterval(window.floatingTimer);
  //   window.floatingTimer = null;
  // }
}

/*
 * 功能：读取悬浮窗持久化状态（utools.dbStorage）
 * 参数：无
 * 返回值：Object { visible?:Boolean, x?:Number, y?:Number }
 * 创建日期：2025-12-01
 * 更新日期：2025-12-15 (迁移至 dbStorage)
 */
function getFloatingState() {
  try {
    const raw = window.utools.dbStorage.getItem('floatingWindowState');
    return raw ? raw : { visible: false };
  } catch (_) { return { visible: false }; }
}

/*
 * 功能：更新悬浮窗持久化状态（utools.dbStorage）
 * 参数：patch(Object) 包含要更新的字段
 * 返回值：无
 * 创建日期：2025-12-01
 * 更新日期：2025-12-15 (迁移至 dbStorage)
 */
function persistFloatingState(patch) {
  try {
    const prev = getFloatingState() || {};
    const next = { ...prev, ...patch };
    window.utools.dbStorage.setItem('floatingWindowState', next);
  } catch (_) {}
}

// 进程监控
// 已移除：进程监控与导出方法

/*
 * 功能：读取微件运行状态文件
 * 参数：无
 * 返回值：Object | null 状态内容，如 {running, pid, updatedAt, version, stage}
 * 日期：2025-12-01
 */
// 已移除：微件运行状态读取

/*
 * 功能：检测微件是否运行（进程+心跳文件）
 * 参数：无
 * 返回值：Boolean 是否判定为运行中
 * 日期：2025-12-01
 */
// 已移除：微件存活检测

/*
 * 功能：启动微件心跳监测（2s）并在UI上提示连接状态
 * 参数：无
 * 返回值：无
 * 日期：2025-12-01
 */
// 已移除：微件心跳监测

// 监听窗口隐藏事件
window.utools.onPluginOut(() => {
  window.logger.log(`[插件生命周期] onPluginOut 触发`);
  
  const app = document.getElementById('app');
  if (app) {
    const currentDisplay = app.style.display;
    window.logger.log(`[插件生命周期] app元素当前display状态: ${currentDisplay || 'default'}`);
    app.style.display = 'none';
    window.logger.log(`[插件生命周期] app元素display已设置为: none`);
  } else {
    window.logger.error(`[插件生命周期] 未找到app元素`);
  }
  /*
   * 功能：插件隐藏时暂停悬浮窗更新定时器
   * 参数：无
   * 返回值：无
   * 创建日期：2025-12-01
  */
  
  
  window.logger.log(`[插件生命周期] onPluginOut 处理完成，返回false阻止退出`);
  return false; // 返回false以阻止插件退出
}); 

// 提供隐藏窗口的方法
window.hideWindow = () => {
  document.getElementById('app').style.display = 'none';
  window.utools.hideMainWindow(); // 隐藏主窗口
};



// 插件准备就绪时初始化显示
window.utools.onPluginReady(() => {
  const appElement = document.getElementById('app');
  if (appElement) {
    appElement.style.display = 'block';
  }
  /**
   * 在插件就绪时恢复悬浮窗
   * 功能：若上次退出前悬浮窗为可见，则自动恢复打开并还原位置
   * 参数：无
   * 返回值：无
   * 创建日期：2025-12-08
   */
  const state = getFloatingState();
  window.__floatingVisible = !!(state && state.visible);
  // 初始化按钮文案
  try {
    const btn = document.getElementById('floating-toggle-btn');
    if (btn) btn.textContent = window.__floatingVisible ? '隐藏悬浮窗' : '显示悬浮窗';
  } catch (_) {}
  // 自动恢复悬浮窗
  if (state && state.visible) {
    setTimeout(() => {
      try { window.openFloatingWindow(); } catch (_) {}
    }, 100);

    // 兜底：若首次尝试未成功显示窗口，延迟重试一次
    setTimeout(() => {
      try {
        const retryState = getFloatingState();
        const exists = window.floatingWin && !window.floatingWin.isDestroyed();
        let visible = false;
        if (exists && typeof window.floatingWin.isVisible === 'function') {
          visible = window.floatingWin.isVisible();
        }
        if (retryState && retryState.visible && (!exists || !visible)) {
          window.logger.log('[插件生命周期] onPluginReady: 检测到悬浮窗未成功显示，执行兜底唤醒');
          window.openFloatingWindow();
        }
      } catch (_) {}
    }, 3000);
  }
  /*
   * 功能：启动桌面微件数据同步
   * 参数：无
   * 返回值：无
   * 创建日期：2025-12-01
  */
  // 已移除微件数据同步与心跳监测
});

// 处理预提醒时间变更
window.handlePreAlertTimeChange = () => {
  const preAlertTime = parseInt(document.getElementById('pre-alert-time').value);
  const preAlertCount = preAlertTime > 3 ? 2 : 1;
  const globalAlertEnabled = document.getElementById('global-alert-toggle').value === 'true';
  
  // 更新UI和存储
  document.getElementById('pre-alert-count').value = preAlertCount;
  window.utools.dbStorage.setItem('globalSettings', {
    preAlertTime,
    preAlertCount,
    globalAlertEnabled,
    notificationType: 'popup' // 固定使用弹窗通知
  });
  try {
    const st = getFloatingState();
    if (st && st.visible) window.pushFloatingData();
  } catch (_) {}
};

window.handleAvatarUpload = () => {
  const result = utools.showOpenDialog({
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif'] }],
    properties: ['openFile']
  });
  if (result && result.length > 0) {
    const file = result[0];
    const destPath = path.join(window.utools.getPath('userData'), 'touxiang.png');
    window.logger.log('[头像上传] 开始复制文件:', {源文件: file, 目标路径: destPath});
    
    try {
      fs.copyFileSync(file, destPath);
      const config = JSON.parse(window.utools.dbStorage.getItem('globalConfig') || '{}');
      config.avatar = destPath;
      window.utools.dbStorage.setItem('globalConfig', JSON.stringify(config));
      window.logger.log('[头像上传] 文件复制成功，更新数据库');
      
      // 更新预览并添加时间戳参数
      const timestamp = new Date().getTime();
      document.getElementById('avatarPreview').src = `${destPath}?t=${timestamp}`;
      window.logger.log('[头像预览] 已更新预览地址:', `${destPath}?t=${timestamp}`);
    } catch (error) {
      window.logger.error('[头像上传] 文件复制失败:', error);
      window.showToast(`头像更新失败: ${error.message}`, 'error');
    }
  }
};

// 铃声上传功能
window.handleBellSoundUpload = () => {
  const result = utools.showOpenDialog({
    filters: [{ name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'] }],
    properties: ['openFile']
  });
  if (result && result.length > 0) {
    const file = result[0];
    const fileName = path.basename(file);
    const destPath = path.join(window.utools.getPath('userData'), `bell_${fileName}`);
    window.logger.log('[铃声上传] 开始复制文件:', {源文件: file, 目标路径: destPath});
    
    try {
      fs.copyFileSync(file, destPath);
      const config = JSON.parse(window.utools.dbStorage.getItem('globalConfig') || '{}');
      config.customBellSound = destPath;
      config.bellSoundType = 'custom';
      window.utools.dbStorage.setItem('globalConfig', JSON.stringify(config));
      window.logger.log('[铃声上传] 文件复制成功，更新数据库');
      
      // 更新UI显示
      updateBellSoundUI();
      window.showToast(`已设置自定义铃声: ${fileName}`);
    } catch (error) {
      window.logger.error('[铃声上传] 文件复制失败:', error);
      window.showToast(`铃声设置失败: ${error.message}`, 'error');
    }
  }
};

// 重置为默认铃声
window.resetToDefaultBellSound = () => {
  try {
    const config = JSON.parse(window.utools.dbStorage.getItem('globalConfig') || '{}');
    config.bellSoundType = 'default';
    window.utools.dbStorage.setItem('globalConfig', JSON.stringify(config));
    window.logger.log('[铃声设置] 重置为默认铃声');
    
    // 更新UI显示
    updateBellSoundUI();
    window.showToast('已重置为默认铃声');
  } catch (error) {
    window.logger.error('[铃声设置] 重置失败:', error);
    window.showToast(`铃声设置失败: ${error.message}`, 'error');
  }
};

// 更新铃声UI显示
function updateBellSoundUI() {
  const config = JSON.parse(window.utools.dbStorage.getItem('globalConfig') || '{}');
  const bellSoundType = config.bellSoundType || 'default';
  const customBellSound = config.customBellSound;
  
  const statusElement = document.getElementById('bell-sound-status');
  if (statusElement) {
    if (bellSoundType === 'custom' && customBellSound) {
      const fileName = path.basename(customBellSound);
      statusElement.textContent = `当前: 自定义铃声 (${fileName})`;
      statusElement.style.color = '#52c41a';
    } else {
      statusElement.textContent = '当前: 默认铃声';
      statusElement.style.color = '#666';
    }
  }
}

// 修改后的保存时间设置方法
function getRandomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  // 提醒系统状态机
  const AlertState = {
    IDLE: 'idle',
    RUNNING: 'running',
    PRE_ALERT: 'pre_alert',
    ALERTING: 'alerting',
    PAUSED: 'paused',
    COMPLETED: 'completed'
  };
  
  // 全局状态变量
  const lastAlertDates = new Map();
  const lastNotificationTimes = new Map();
  const lastPreAlertTimes = new Map();
  const lastRemainingMinutes = new Map();
  
  class AlertManager {
    constructor() {
      this.state = AlertState.IDLE;
      this.timeBlocks = window.getTimeSettings();
      this.timer = null;
      this.startGlobalTimer();
    }
  
    startTimeBlock(block) {
      this.timeBlocks.push(block);
      if (!this.timer) {
        this.startGlobalTimer();
      }
    }
  
    startGlobalTimer() {
      if (this.timer) return;
      
      this.timer = setInterval(() => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = now.getTime();
  
        window.logger.debug(`[时间检查] 当前时间: ${currentHour}:${currentMinute}`);
        this.timeBlocks = window.getTimeSettings();
        let hasUpdates = false;

        const settings = window.utools.dbStorage.getItem('globalSettings') || {
          preAlertTime: 3,
          preAlertCount: 1,
          globalAlertEnabled: true
        };
        if (!settings || settings.globalAlertEnabled === false) return;
        
        this.timeBlocks.forEach((block, index) => {
          if (!block.enabled || block.status !== 'pending') return;
          
          const blockTime = new Date(block.startTime);
          const blockHour = blockTime.getHours();
          const blockMinute = blockTime.getMinutes();
          const totalBlockMinutes = blockHour * 60 + blockMinute;
          const totalCurrentMinutes = currentHour * 60 + currentMinute;
          const timeDiff = totalBlockMinutes - totalCurrentMinutes;

          window.logger.debug(`[时间检查] 检查时间块: ${block.task}, 预定时间: ${blockHour}:${blockMinute} 总分钟差: ${timeDiff}`);
  
          // 检查预提醒条件
          if (block.preAlert && timeDiff > 0 && timeDiff <= settings.preAlertTime) {
            // 检查星期提醒模式（预提醒也需要遵循星期设置）
            const reminderMode = block.reminderMode || 'daily';
            const currentWeekday = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
            
            let shouldPreAlert = true;
            if (reminderMode === 'weekly') {
              // 检查今天是否在选定的星期内
              const weekdays = block.weekdays || [];
              shouldPreAlert = weekdays.includes(currentWeekday);
              window.logger.debug(`[时间检查] 预提醒星期检查: ${block.task}, 当前星期: ${currentWeekday}, 选定星期: ${weekdays}, 是否预提醒: ${shouldPreAlert}`);
            }
            
            if (shouldPreAlert) {
              const lastPreAlertTime = lastPreAlertTimes.get(block.id) || 0;
              const lastRemaining = lastRemainingMinutes.get(block.id) || 0;
              const preAlertInterval = Math.floor(settings.preAlertTime / settings.preAlertCount);
              window.logger.debug(`[时间检查] 检查预提醒条件: ${block.task}, 剩余${timeDiff}分钟, 上次提醒时间: ${lastPreAlertTime}, 上次剩余: ${lastRemaining}`)
              if (lastRemaining !== timeDiff && 
                  currentTime - lastPreAlertTime >= preAlertInterval * 60000 && 
                  settings.preAlertCount > lastPreAlertTimes.size) {
                window.logger.log(`[时间检查] 触发预提醒: ${block.task}, 剩余${timeDiff}分钟`);
                this.showSideAlert(block, timeDiff);
                lastRemainingMinutes.set(block.id, timeDiff);
                lastPreAlertTimes.set(block.id, currentTime);
                hasUpdates = true;
              }
            } else {
              window.logger.debug(`[时间检查] 今天不在预提醒星期范围内: ${block.task}，跳过预提醒`);
            }
          }
  
          // 检查主提醒条件
          if (currentHour === blockHour && currentMinute === blockMinute) {
            // 检查星期提醒模式
            const reminderMode = block.reminderMode || 'daily';
            const currentWeekday = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
            
            let shouldAlert = true;
            if (reminderMode === 'weekly') {
              // 检查今天是否在选定的星期内
              const weekdays = block.weekdays || [];
              shouldAlert = weekdays.includes(currentWeekday);
              window.logger.debug(`[时间检查] 星期提醒模式: ${block.task}, 当前星期: ${currentWeekday}, 选定星期: ${weekdays}, 是否提醒: ${shouldAlert}`);
            }
            
            if (!shouldAlert) {
              window.logger.debug(`[时间检查] 今天不在提醒星期范围内: ${block.task}，跳过提醒`);
              return;
            }
            
            // 检查是否今天已经提醒过，并确保至少间隔30秒
            const today = new Date().setHours(0, 0, 0, 0);
            const lastNotificationTime = lastNotificationTimes.get(block.id) || 0;
            const lastAlertDate = lastAlertDates.get(block.id);
            
            if (lastAlertDate !== today && currentTime - lastNotificationTime >= 10000) {
              window.logger.log(`[时间检查] 触发主提醒: ${block.task}`);
              this.showAlert(block);
              lastAlertDates.set(block.id, today);
              lastNotificationTimes.set(block.id, currentTime);
              
              // 处理快速闹钟（单次提醒）
              if (block.reminderMode === 'once') {
                window.logger.log(`[时间检查] 快速闹钟触发完毕，自动删除: ${block.task}`);
                window.deleteTimeBlock(block.id);
                // 重新获取列表以反映删除
                hasUpdates = true;
                return; // 跳过后续重置逻辑
              }
              
              // 处理提醒次数（兼容性处理）
              const reminderCount = block.reminderCount !== undefined ? block.reminderCount : -1;
              const remainingCount = block.remainingCount !== undefined ? block.remainingCount : reminderCount;
              
              if (reminderCount !== -1) { // 不是永久提醒
                if (remainingCount > 0) {
                  block.remainingCount = remainingCount - 1;
                } else if (remainingCount <= 0) {
                  block.status = 'disabled'; // 提醒次数用完后禁用
                }
              }
              
              // 重置时间块状态
              if (reminderMode === 'daily') {
                // 每日提醒：设置为明天同一时间
                const tomorrow = new Date(blockTime);
                tomorrow.setDate(tomorrow.getDate() + 1);
                block.startTime = tomorrow.getTime();
              } else if (reminderMode === 'weekly') {
                // 星期提醒：设置为下一个符合条件的日期
                const nextDate = this.getNextWeeklyAlertDate(blockTime, block.weekdays);
                block.startTime = nextDate.getTime();
              }
              
              block.status = 'pending';
              // 重置上一次剩余分钟数和预提醒相关状态
              lastRemainingMinutes.delete(block.id);
              lastPreAlertTimes.delete(block.id);
              hasUpdates = true;
              window.logger.log(`[时间检查] 重置时间块: ${block.task}, 下次提醒时间: ${new Date(block.startTime).toLocaleString()}`);
            } else {
              window.logger.debug(`[时间检查] 今天已经提醒过或间隔太短: ${block.task}，跳过提醒`);
            }
  
          }
        });
        
        // 每次轮询结束后，同步更新悬浮窗数据
        try { window.pushFloatingData(); } catch (_) {}

      }, 5000);
    }
  
    showSideAlert(block, remainingMinutes) {
      window.logger.log(`[预提醒] 显示预提醒: ${block.task}, 剩余${remainingMinutes}分钟`);
      
      // 播放铃声
      window.playBellSound();
      
      window.sendNotification(
        `${block.task}`,
        `还剩${remainingMinutes}分钟`
      );
    }
  
    showAlert(block) {
      window.logger.log(`[主提醒] 显示主提醒: ${block.task}`);
      
      // 播放铃声
      window.playBellSound();
      
      // 统计用户真实使用情况
      try {
        if (window.umami && typeof window.umami.track === 'function') {
          window.umami.track('alert-triggered', {
            task: block.task,
            time: new Date().toLocaleTimeString(),
            hasPreAlert: block.preAlert || false
          });
          window.logger.log('[统计] 主提醒事件已记录');
        }
      } catch (error) {
        window.logger.log('[统计] 统计记录失败:', error);
      }
      
      // 发送系统通知
      window.sendNotification(
        block.task,
        '时间到！'
      );
    }
  
    // 计算下一个星期提醒日期
    getNextWeeklyAlertDate(currentDate, weekdays) {
      const date = new Date(currentDate);
      const currentWeekday = date.getDay();
      
      // 找到下一个符合条件的星期
      let daysToAdd = 1;
      for (let i = 1; i <= 7; i++) {
        const nextWeekday = (currentWeekday + i) % 7;
        if (weekdays.includes(nextWeekday)) {
          daysToAdd = i;
          break;
        }
      }
      
      date.setDate(date.getDate() + daysToAdd);
      return date;
    }

    handleAction(action) {
      if (action === 'complete') {
        this.state = AlertState.COMPLETED;
        this.currentBlock.status = 'completed';
        this.cleanup();
      } else if (action === 'delay') {
        this.state = AlertState.PAUSED;
        setTimeout(() => {
          this.state = AlertState.RUNNING;
          this.startTimer();
        }, 600000); // 10分钟后重新开始
      }
    }
  
    cleanup() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      document.getElementById('side-alert').style.display = 'none';
      document.getElementById('alert-overlay').style.display = 'none';
    }
  }
  
  window.alertManager = new AlertManager();
  
  // 修改后的保存时间设置方法
  window.globalConfig = {
    avatarPath: '',
    ...JSON.parse(window.localStorage.getItem('globalConfig') || '{}')
  };
  
  window.saveGlobalAvatar = (path) => {
    window.globalConfig.avatarPath = path;
    window.localStorage.setItem('globalConfig', JSON.stringify(window.globalConfig));
  };
  
window.getGlobalAvatar = () => {
  const config = JSON.parse(window.utools.dbStorage.getItem('globalConfig') || '{}');
  return config.avatar || path.join(window.utools.getPath('userData'), 'touxiang.png');
};
/**
 * 记录窗口边界信息
 * 功能：输出窗口当前的物理尺寸与内容尺寸，便于定位尺寸膨胀问题
 * 参数：win - BrowserWindow 实例；tag - 字符串标签用于区分日志位置
 * 返回值：无
 * 创建日期：2025-12-08
 */
// 已移除调试用尺寸记录函数

/**
 * 监听来自悬浮窗的日志
 * 功能：接收悬浮窗通过 IPC 发送过来的日志消息，并在主窗口控制台与文件中输出
 * 参数：无（使用全局 ipcRenderer 通道）
 * 返回值：无
 * 创建日期：2025-12-08
 */
// 移除悬浮窗日志代理监听，减负

/**
 * 监听悬浮窗操作通道（仅记录日志）
 * 功能：接收悬浮窗通过 'widget-action' 通道发送的移动请求，主窗口仅记录收到的参数和窗口当前尺寸，不改变现有移动逻辑
 * 参数：无
 * 返回值：无
 * 创建日期：2025-12-08
 */
try {
  ipcRenderer.on('widget-action', (event, action) => {
    try {
      // 仅处理移动，不输出调试日志
    } catch (_) {}

    // 记录当前悬浮窗尺寸（如果可用）
    try {
      const win = window.floatingWin;
      if (win && !win.isDestroyed()) {
        // 若为移动请求，统一在主进程执行并锁定内容尺寸 300x45
        try {
          if (action && action.type === 'move') {
            const x = Math.round(action.x);
            const y = Math.round(action.y);
            // 使用内容边界，避免物理边界随非客户区变化
            try {
              win.setContentBounds({ x, y, width: 300, height: 45 });
            } catch (e) {
              // 兜底：若 setContentBounds 不可用，退回 setBounds
              win.setBounds({ x, y, width: 300, height: 45 });
            }
          }
        } catch (_) {}
      } else {
        window.logger.log('[悬浮窗] main-recv: 无有效窗口实例');
      }
    } catch (_) {}
  });
} catch (_) {}
