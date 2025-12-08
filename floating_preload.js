/**
 * 悬浮窗 Preload
 * date: 2025-12-05
 */
const { ipcRenderer } = require('electron');

// 尝试获取 remote
let remote = null;
// 强制禁用 remote，因为在 Windows 透明窗口下，renderer 进程调用 setBounds 会导致尺寸计算异常（窗口变大）
// 我们统一使用 IPC 通知主进程调用 setPosition 来移动窗口
/*
try {
    remote = require('@electron/remote');
} catch (e) {
    try {
        remote = require('electron').remote;
    } catch (e2) {}
}
*/

const CHANNEL = 'widget-message';
const ACTION_CHANNEL = 'widget-action';
let mainId = null;

// 监听来自主窗口或其他源的强制关闭消息
ipcRenderer.on('force-close', () => {
    console.log('收到强制关闭指令');
    window.close();
});

window.widgetApi = {
    /**
     * 监听消息
     * @param {Function} callback 
     */
    onMessage: (callback) => {
        ipcRenderer.on(CHANNEL, (event, msg) => {
            // 自动记录发送者 ID
            if (!mainId && event.senderId) {
                mainId = event.senderId;
                console.log('连接到主窗口，ID:', mainId);
            }
            callback(msg);
        });
    },

    /**
     * 发送消息给主窗口
     * @param {string} msg 
     */
    sendToMain: (msg) => {
        if (mainId) {
            ipcRenderer.sendTo(mainId, CHANNEL, msg);
        } else {
            console.warn('未连接到主窗口');
        }
    },

    /**
     * 移动窗口
     * @param {number} x 
     * @param {number} y 
     */
    setBounds: (x, y) => {
        try {
            // 为避免与主进程移动产生竞态，这里仅做最末级降级处理
            window.moveTo(Math.round(x), Math.round(y));
        } catch (e) {
            console.error('setBounds failed', e);
        }
    },

    /**
     * 请求移动窗口
     * @param {number} x 
     * @param {number} y 
     */
    requestMove: (x, y) => {
        // 统一路径：仅通过 IPC 请求主进程处理移动（不打印调试日志）
        if (mainId) {
            ipcRenderer.sendTo(mainId, ACTION_CHANNEL, {
                type: 'move',
                x: x,
                y: y
            });
            return;
        }
        // 兜底：无主窗口连接时，使用 window.moveTo
        try { window.widgetApi.setBounds(x, y); } catch (_) {}
    },
    
    /**
     * 请求关闭悬浮窗
     */
    close: () => {
        console.log('请求关闭悬浮窗');
        // 1. 通知主窗口更新状态
        if (mainId) {
            try {
                ipcRenderer.sendTo(mainId, CHANNEL, { type: 'close-floating' });
            } catch (e) {
                console.error('发送关闭消息失败', e);
            }
        }
        
        // 2. 无论是否连接，都强制关闭自身
        // 延迟一点点确保消息发出
        setTimeout(() => {
            window.close();
        }, 50);
    }
};

// 尝试注入 remote
try {
    const { remote } = require('electron');
    if (remote) {
        const win = remote.getCurrentWindow();
        window.widgetApi.setWindowPos = (x, y) => {
            win.setPosition(Math.round(x), Math.round(y));
        };
    }
} catch (e) {
    // ignore
}

// 移除日志代理，减少调试输出
