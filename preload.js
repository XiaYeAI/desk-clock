const { ipcRenderer } = require('electron');
const { exec } = require('child_process');

const TIME_BLOCKS_KEY = 'timeBlocks';

// 初始化存储
function initStorage() {
  if (!window.utools.dbStorage.getItem(TIME_BLOCKS_KEY)) {
    window.utools.dbStorage.setItem(TIME_BLOCKS_KEY, []);
  }
}

// 导出到window对象供渲染进程使用
window.exports = {
  'desk-clock': {
    mode: 'none',
    args: {
      enter: () => {
        initStorage();
        document.getElementById('app').style.display = 'block';
      }
    }
  }
};

// 时间块管理
window.saveTimeSettings = (blocks) => {
  // 确保每个时间块都有唯一ID、创建时间和状态
  const updatedBlocks = blocks.map(block => ({
    ...block,
    id: block.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
    createdAt: block.createdAt || Date.now(),
    status: block.status || 'pending'
  }));
  window.utools.dbStorage.setItem(TIME_BLOCKS_KEY, updatedBlocks);
  window.alertManager.updateTimeBlocks();
};

window.getTimeSettings = () => {
  return window.utools.dbStorage.getItem(TIME_BLOCKS_KEY) || [];
};

window.deleteTimeBlock = (id) => {
  const blocks = window.getTimeSettings();
  const updatedBlocks = blocks.filter(block => block.id !== id);
  window.saveTimeSettings(updatedBlocks);
  window.alertManager.updateTimeBlocks();
};

window.updateTimeBlock = (id, updatedData) => {
  const blocks = window.getTimeSettings();
  const index = blocks.findIndex(block => block.id === id);
  if (index !== -1) {
    blocks[index] = { ...blocks[index], ...updatedData };
    window.saveTimeSettings(blocks);
    return true;
  }
  return false;
};



// 通知系统
const path = require('path');

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
    const avatarUrl = './touxiang.png';

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
  if (window.alertManager) {
    window.alertManager.updateTimeBlocks = function() {
      this.timeBlocks = window.getTimeSettings();
      this.currentBlock = this.timeBlocks.find(b => b.status === 'active');
      this.currentAvatar = window.getGlobalAvatar() || './logo.svg';
    };
  }

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

// 监听窗口显示事件
window.utools.onPluginEnter(({ code, type, payload }) => {
  document.getElementById('app').style.display = 'block';
  window.utools.showMainWindow(); // 显示主窗口
});

// 自然语言解析器
// 处理头像上传
window.handleAvatarUpload = () => {
  window.utools.showOpenDialog({
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] }],
    properties: ['openFile']
  }).then(result => {
    if (result && result.length > 0) {
      const filePath = result[0];
      const fs = require('fs');
      const imageData = fs.readFileSync(filePath, { encoding: 'base64' });
      const dataUrl = `data:image/png;base64,${imageData}`;
      document.getElementById('avatarPreview').src = dataUrl;
      window.utools.dbStorage.setItem('globalAvatar', dataUrl);
    }
  });
};

// 初始化全局配置
window.initStorage = () => {
  if (!window.utools.dbStorage.getItem('globalConfig')) {
    window.utools.dbStorage.setItem('globalConfig', JSON.stringify({ avatar: '' }));
  }
  window.globalConfig = JSON.parse(window.utools.dbStorage.getItem('globalConfig'));
};

window.parseTimeBlock = (text) => {
  const timePointPattern = /(\d{1,2}:\d{2})\s*([\p{Script=Han}a-zA-Z]+)/gu;
  const blocks = [];
  let match;

  // 解析时间点格式（如：09:00 写周报）
  for (const match of text.matchAll(timePointPattern)) {
    const [_, timeStr, task] = match;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const taskTime = new Date();
    taskTime.setHours(hours, minutes, 0, 0);

    // 如果设置的时间已经过去，则设置为明天
    if (taskTime < new Date()) {
      taskTime.setDate(taskTime.getDate() + 1);
    }

    blocks.push({
      task,
      startTime: taskTime.getTime(),
      color: getRandomColor(),
      enabled: true,
      status: 'pending'
    });
  }
  return blocks;
};

// 生成随机颜色
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

  updateTimeBlocks() {
    this.timeBlocks = window.getTimeSettings();
    //this.currentBlock = this.timeBlocks.find(b => b.status === 'active');
    //this.currentAvatar = window.getGlobalAvatar() || './logo.svg';
    
    // 重置修改过的时间块的提醒状态
    this.timeBlocks.forEach(block => {
      lastAlertDates.delete(block.id);
      lastNotificationTimes.delete(block.id);
      lastPreAlertTimes.delete(block.id);
      lastRemainingMinutes.delete(block.id);
    });
    
    console.log('[AlertManager] 时间块数据和提醒状态已更新');
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

      this.timeBlocks.forEach((block, index) => {
        //console.log(`[时间检查] 循环时间块: ${block.task}${block.enabled}, 当前状态: ${block.status}`);
        if (!block.enabled || block.status !== 'pending') return;
        
        const blockTime = new Date(block.startTime);
        const blockHour = blockTime.getHours();
        const blockMinute = blockTime.getMinutes();
        console.log(`[时间检查] 检查时间块: ${block.task}, 预定时间: ${blockHour}:${blockMinute}`);

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
            // 重置时间块状态，设置为明天同一时间
            const tomorrow = new Date(blockTime);
            tomorrow.setDate(tomorrow.getDate() + 1);
            block.startTime = tomorrow.getTime();
            block.status = 'pending';
            // 重置上一次剩余分钟数
            lastRemainingMinutes.delete(block.id);
            hasUpdates = true;
            console.log(`[时间检查] 重置时间块到明天: ${block.task}, 时间: ${tomorrow.getHours()}:${tomorrow.getMinutes()}`);
          } else {
            console.log(`[时间检查] 今天已经提醒过或间隔太短: ${block.task}，跳过提醒`);
          }
        } else if (currentHour === blockHour && blockMinute - currentMinute <= 5 && blockMinute - currentMinute > 0) {
          const remainingMinutes = blockMinute - currentMinute;
          const lastPreAlertTime = lastPreAlertTimes.get(block.id) || 0;
          const lastRemaining = lastRemainingMinutes.get(block.id);
          
          // 确保预提醒至少间隔60秒
          if (lastRemaining !== remainingMinutes && currentTime - lastPreAlertTime >= 60000) {
            console.log(`[时间检查] 触发预提醒: ${block.task}, 剩余${remainingMinutes}分钟`);
            this.showSideAlert(block, remainingMinutes);
            lastRemainingMinutes.set(block.id, remainingMinutes);
            lastPreAlertTimes.set(block.id, currentTime);
            hasUpdates = true;
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

// 添加头像上传处理
const fs = require('fs');

// 处理头像上传
window.handleAvatarUpload = () => {
  const result = utools.showOpenDialog({
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif'] }],
    properties: ['openFile']
  });
  if (result && result.length > 0) {
    const file = result[0];
    const destPath = path.join(__dirname, 'touxiang.png');
    fs.copyFileSync(file, destPath);
  }
};

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
  return window.globalConfig.avatarPath;
};