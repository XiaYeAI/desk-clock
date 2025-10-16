const { ipcRenderer } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const TIME_BLOCKS_KEY = 'timeBlocks';

/**
 * 环境检测和日志管理器
 * 功能：区分开发环境和生产环境，控制日志输出
 * 创建日期：2025-01-16
 */
class LogManager {
  constructor() {
    this.isDevelopment = this.detectEnvironment();
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
   * 初始化日志器
   * 功能：根据环境设置日志输出策略
   * 创建日期：2025-01-16
   */
  initLogger() {
    if (this.isDevelopment) {
      // 开发环境：保持所有日志输出
      this.log = console.log.bind(console);
      this.error = console.error.bind(console);
      this.warn = console.warn.bind(console);
      this.info = console.info.bind(console);
      this.debug = console.debug.bind(console);
    } else {
      // 生产环境：只保留错误日志，其他日志静默
      this.log = () => {}; // 静默
      this.error = console.error.bind(console); // 保留错误日志
      this.warn = () => {}; // 静默
      this.info = () => {}; // 静默
      this.debug = () => {}; // 静默
    }
  }

  /**
   * 获取当前环境信息
   * 返回值：string - 环境描述
   * 创建日期：2025-01-16
   */
  getEnvironmentInfo() {
    return this.isDevelopment ? '开发环境' : '生产环境';
  }
}

// 创建全局日志管理器实例
window.logger = new LogManager();

// 输出环境信息（仅在开发环境）
window.logger.log(`[日志管理器] 当前运行环境: ${window.logger.getEnvironmentInfo()}`);

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
      notificationType: 'popup' // 'popup' - 弹窗通知, 'system' - 系统通知
    };
    window.utools.dbStorage.setItem('globalSettings', globalSettings);
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
  });
}

// 在插件加载时初始化存储
initStorage();

// 在DOM加载完成后初始化UI和主题
document.addEventListener('DOMContentLoaded', () => {
  initUIAndTheme();
  // 显示主窗口
  const appElement = document.getElementById('app');
  if (appElement) {
    appElement.style.display = 'block';
  }
});

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

// 进程监控
let activeProcesses = new Set();

function checkActiveProcesses() {
  exec('tasklist /fo csv /nh', (error, stdout) => {
    if (error) return;
    
    const processes = stdout.split('\n')
      .map(line => {
        const match = line.match(/"([^"]+)"/);
        return match ? match[1].toLowerCase() : null;
      })
      .filter(Boolean);

    activeProcesses = new Set(processes);
  });
}

// 定时检查进程
setInterval(checkActiveProcesses, 5000);

// 导出进程检查方法
window.isProcessRunning = (processName) => {
  return activeProcesses.has(processName.toLowerCase());
};

// 监听窗口隐藏事件
window.utools.onPluginOut(() => {
  // 隐藏窗口但保持后台运行
  document.getElementById('app').style.display = 'none';
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
  
        window.logger.log(`[时间检查] 当前时间: ${currentHour}:${currentMinute}`);
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
  
          window.logger.log(`[时间检查] 检查时间块: ${block.task}, 预定时间: ${blockHour}:${blockMinute} 总分钟差: ${timeDiff}`);
  
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
              window.logger.log(`[时间检查] 预提醒星期检查: ${block.task}, 当前星期: ${currentWeekday}, 选定星期: ${weekdays}, 是否预提醒: ${shouldPreAlert}`);
            }
            
            if (shouldPreAlert) {
              const lastPreAlertTime = lastPreAlertTimes.get(block.id) || 0;
              const lastRemaining = lastRemainingMinutes.get(block.id) || 0;
              const preAlertInterval = Math.floor(settings.preAlertTime / settings.preAlertCount);
              window.logger.log(`[时间检查] 检查预提醒条件: ${block.task}, 剩余${timeDiff}分钟, 上次提醒时间: ${lastPreAlertTime}, 上次剩余: ${lastRemaining}`)
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
              window.logger.log(`[时间检查] 今天不在预提醒星期范围内: ${block.task}，跳过预提醒`);
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
              window.logger.log(`[时间检查] 星期提醒模式: ${block.task}, 当前星期: ${currentWeekday}, 选定星期: ${weekdays}, 是否提醒: ${shouldAlert}`);
            }
            
            if (!shouldAlert) {
              window.logger.log(`[时间检查] 今天不在提醒星期范围内: ${block.task}，跳过提醒`);
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
              window.logger.log(`[时间检查] 今天已经提醒过或间隔太短: ${block.task}，跳过提醒`);
            }
  
          }
        });
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