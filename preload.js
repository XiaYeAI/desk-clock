const { ipcRenderer } = require('electron');
const { exec } = require('child_process');
const path = require('path');

const TIME_BLOCKS_KEY = 'timeBlocks';

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
      globalAlertEnabled: true
    };
    window.utools.dbStorage.setItem('globalSettings', globalSettings);
  }
  
  // 初始化头像配置
  if (!window.utools.dbStorage.getItem('globalConfig')) {
    window.utools.dbStorage.setItem('globalConfig', JSON.stringify({ avatar: path.join(window.utools.getPath('userData'), 'touxiang.png') }));
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
  
  // 设置初始主题
  const isDarkMode = window.utools.isDarkColors();
  document.documentElement.setAttribute('theme', isDarkMode ? 'dark' : 'light');
  
  // 每次插件进入时统一处理主题同步、窗口显示和时间线渲染
  window.utools.onPluginEnter(({ code, type, payload }) => {
    // 同步主题
    const isDarkMode = window.utools.isDarkColors();
    document.documentElement.setAttribute('theme', isDarkMode ? 'dark' : 'light');
    
    // 显示主窗口
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.style.display = 'block';
      window.utools.showMainWindow();
    }
    
    // 更新时间线和时间块列表
    if (typeof renderTimeline === 'function') renderTimeline();
    if (typeof renderTimeBlockList === 'function') renderTimeBlockList();
  });

  // 检查并设置头像
  const fs = require('fs');
  const avatarPath = path.join(window.utools.getPath('userData'), 'touxiang.png');
  const defaultAvatarPath = './logo.svg';
  
  // 等待一段时间确保CSS样式已加载
  setTimeout(() => {
    try {
      if (fs.existsSync(avatarPath)) {
        const avatarPreview = document.getElementById('avatarPreview');
        if (avatarPreview) {
          avatarPreview.src = `file://${avatarPath}?t=${new Date().getTime()}`;
          console.log('[头像] 成功加载touxiang.png');
        }
      } else {
        console.log('[头像] touxiang.png不存在，使用默认头像');
        const avatarPreview = document.getElementById('avatarPreview');
        if (avatarPreview) {
          avatarPreview.src = defaultAvatarPath;
        }
      }
    } catch (error) {
      console.error('[头像] 检查头像文件时出错:', error);
      const avatarPreview = document.getElementById('avatarPreview');
      if (avatarPreview) {
        avatarPreview.src = defaultAvatarPath;
      }
    }
  }, 100);
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



// 通知系统

window.sendNotification = (title, body) => {
  console.log(`[通知] 标题: ${title}, 内容: ${body}`);
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
    console.log('[通知] 处理后的头像URL:', avatarUrl);
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
      console.log('[通知窗口] 收到关闭消息，准备关闭窗口');
      if (!win.isDestroyed()) {
        console.log('[通知窗口] 窗口未被销毁，执行关闭操作');
        win.close();
      } else {
        console.log('[通知窗口] 窗口已被销毁，跳过关闭操作');
      }
    }
  });

  win.setPosition(
    Math.floor((window.screen.width - 400) / 2),
    Math.floor((window.screen.height - 200) / 2)
  );
}
)};

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
    globalAlertEnabled
  });
};
const fs = require('fs');
window.handleAvatarUpload = () => {
  const result = utools.showOpenDialog({
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif'] }],
    properties: ['openFile']
  });
  if (result && result.length > 0) {
    const file = result[0];
    const destPath = path.join(window.utools.getPath('userData'), 'touxiang.png');
    console.log('[头像上传] 开始复制文件:', {源文件: file, 目标路径: destPath});
    
    try {
      fs.copyFileSync(file, destPath);
      window.utools.dbStorage.setItem('globalConfig', JSON.stringify({ avatar: destPath }));
      console.log('[头像上传] 文件复制成功，更新数据库');
      
      // 更新预览并添加时间戳参数
      const timestamp = new Date().getTime();
      document.getElementById('avatarPreview').src = `${destPath}?t=${timestamp}`;
      console.log('[头像预览] 已更新预览地址:', `${destPath}?t=${timestamp}`);
    } catch (error) {
      console.error('[头像上传] 文件复制失败:', error);
      window.sendNotification('头像更新失败', error.message);
    }
  }
};

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
  
        console.log(`[时间检查] 当前时间: ${currentHour}:${currentMinute}`);
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
  
          console.log(`[时间检查] 检查时间块: ${block.task}, 预定时间: ${blockHour}:${blockMinute} 总分钟差: ${timeDiff}`);
  
          // 检查预提醒条件
          if (block.preAlert && timeDiff > 0 && timeDiff <= settings.preAlertTime) {
            const lastPreAlertTime = lastPreAlertTimes.get(block.id) || 0;
            const lastRemaining = lastRemainingMinutes.get(block.id) || 0;
            const preAlertInterval = Math.floor(settings.preAlertTime / settings.preAlertCount);
            console.log(`[时间检查] 检查预提醒条件: ${block.task}, 剩余${timeDiff}分钟, 上次提醒时间: ${lastPreAlertTime}, 上次剩余: ${lastRemaining}`)
            if (lastRemaining !== timeDiff && 
                currentTime - lastPreAlertTime >= preAlertInterval * 60000 && 
                settings.preAlertCount > lastPreAlertTimes.size) {
              console.log(`[时间检查] 触发预提醒: ${block.task}, 剩余${timeDiff}分钟`);
              this.showSideAlert(block, timeDiff);
              lastRemainingMinutes.set(block.id, timeDiff);
              lastPreAlertTimes.set(block.id, currentTime);
              hasUpdates = true;
            }
          }
  
          // 检查主提醒条件
          if (currentHour === blockHour && currentMinute === blockMinute) {
            // 检查是否今天已经提醒过，并确保至少间隔30秒
            const today = new Date().setHours(0, 0, 0, 0);
            const lastNotificationTime = lastNotificationTimes.get(block.id) || 0;
            const lastAlertDate = lastAlertDates.get(block.id);
            
            if (lastAlertDate !== today && currentTime - lastNotificationTime >= 10000) {
              console.log(`[时间检查] 触发主提醒: ${block.task}`);
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
              
              // 重置时间块状态，设置为明天同一时间
              const tomorrow = new Date(blockTime);
              tomorrow.setDate(tomorrow.getDate() + 1);
              block.startTime = tomorrow.getTime();
              block.status = 'pending';
              // 重置上一次剩余分钟数和预提醒相关状态
              lastRemainingMinutes.delete(block.id);
              lastPreAlertTimes.delete(block.id);
              hasUpdates = true;
              console.log(`[时间检查] 重置时间块到明天: ${block.task}, 时间: ${tomorrow.getHours()}:${tomorrow.getMinutes()}`);
            } else {
              console.log(`[时间检查] 今天已经提醒过或间隔太短: ${block.task}，跳过提醒`);
            }
  
          }
        });
      }, 5000);
    }
  
    showSideAlert(block, remainingMinutes) {
      console.log(`[预提醒] 显示预提醒: ${block.task}, 剩余${remainingMinutes}分钟`);
      window.sendNotification(
        `${block.task}`,
        `还剩${remainingMinutes}分钟`
      );
    }
  
    showAlert(block) {
      console.log(`[主提醒] 显示主提醒: ${block.task}`);
      
      // 发送系统通知
      window.sendNotification(
        block.task,
        '时间到！'
      );
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