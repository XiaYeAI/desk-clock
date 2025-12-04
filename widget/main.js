/*
 * 功能：Electron 桌面微件入口，创建置顶透明窗口并监听数据文件
 * 参数：无
 * 返回值：无
 * 创建日期：2025-12-01
 */
const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const DATA_DIR = path.join(os.homedir(), 'DeskClock')
const DATA_FILE = path.join(DATA_DIR, 'current_task.json')
const STATE_FILE = path.join(DATA_DIR, 'widget_state.json')
const STATUS_FILE = path.join(DATA_DIR, 'status.json')

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }) } catch (_) {}
}

/*
 * 功能：读取微件位置与尺寸状态
 * 参数：无
 * 返回值：Object {x,y,width,height}
 * 创建日期：2025-12-01
 */
function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch (_) { return { x: undefined, y: undefined, width: 360, height: 68, opacity: 0.7, density: 'standard', topMode: 'always', lockPosition: false, autoHide: false, handleWidth: 6, hidden: false, lastEdge: 'none' } }
}

/*
 * 功能：保存微件位置与尺寸状态（增量合并）
 * 参数：patch(Object)
 * 返回值：无
 * 创建日期：2025-12-01
 */
function saveState(patch) {
  try {
    const current = readState()
    const next = { ...current, ...patch }
    fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2))
  } catch (_) {}
}

/*
 * 功能：读取任务数据文件
 * 参数：无
 * 返回值：Object 或 null
 * 创建日期：2025-12-01
 */
function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch (_) { return null }
}

let win
let settingsWin = null
let pollTimer = null

/*
 * 功能：设置应用开机自启（Windows）
 * 参数：enabled(Boolean) 是否启用
 * 返回值：无
 * 创建日期：2025-12-01
 */
function setAutoLaunch(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      path: process.execPath
    })
  } catch (_) {}
}

function createWindow() {
  ensureDir(DATA_DIR)
  const st = readState()
  setAutoLaunch(st.autoLaunch !== false)
  // 写入启动状态
  writeStatus({ running: true, stage: 'starting' })
  win = new BrowserWindow({
    width: st.width || 360,
    height: st.height || 68,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  try { win.setOpacity(Math.max(0.3, Math.min(1, Number(st.opacity) || 0.7))) } catch(_){ }
  if (typeof st.x === 'number' && typeof st.y === 'number') {
    try { win.setPosition(st.x, st.y) } catch (_) {}
  }
  win.loadFile(path.join(__dirname, 'index.html'))
  try { win.once('ready-to-show', () => { try { win.show(); win.setAlwaysOnTop(true) } catch (_) {} }) } catch (_) {}

  // 右键菜单：打开设置 / 退出
  function openSettingsWindow(){
    try {
      if (settingsWin && !settingsWin.isDestroyed()) {
        settingsWin.focus()
        return
      }
      settingsWin = new BrowserWindow({
        width: 360, height: 320, resizable: false, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true,
        webPreferences: { nodeIntegration: true, contextIsolation: false }
      })
      settingsWin.loadFile(path.join(__dirname, 'settings.html'))
      settingsWin.on('closed', () => { settingsWin = null })
    } catch(_){ }
  }
  // 限定：仅由渲染进程显式请求时弹出右键菜单，避免窗口外右键误触
  try {
    ipcMain.on('widget:context-menu', () => {
      const menu = Menu.buildFromTemplate([
        { label: '打开设置', click: () => openSettingsWindow() },
        { type: 'separator' },
        { label: '退出微件', click: () => { try { win.close() } catch(_){} } }
      ])
      menu.popup({ window: win })
    })
  } catch(_){}

  ipcMain.on('widget:save-position', (_, pos) => {
    const bounds = win.getBounds()
    const next = { x: pos?.x ?? bounds.x, y: pos?.y ?? bounds.y, width: 360, height: 68 }
    saveState(next)
  })

  /*
   * 功能：关闭当前设置窗口
   * 参数：无
   * 返回值：无
   * 日期：2025-12-02
   */
  ipcMain.on('widget:close-settings', () => {
    try { if (settingsWin && !settingsWin.isDestroyed()) settingsWin.close() } catch(_){}
  })
  // 兼容旧调用
  ipcMain.on('widget:close-me', () => {
    try { if (settingsWin && !settingsWin.isDestroyed()) settingsWin.close() } catch(_){}
  })

  ipcMain.on('widget:set-opacity', (_, value) => {
    const v = Math.max(0.3, Math.min(1, Number(value) || 0.7))
    try { win.setOpacity(v) } catch(_){}
    const s = { ...readState(), opacity: v }
    saveState(s)
  })

  ipcMain.on('widget:set-density', (_, value) => {
    const s = { ...readState(), density: value === 'compact' ? 'compact' : 'standard' }
    saveState(s)
    try { win.webContents.send('widget:density', s.density) } catch(_){}
  })

  ipcMain.on('widget:set-topmode', (_, value) => {
    const mode = ['always','work','never'].includes(value) ? value : 'always'
    const s = { ...readState(), topMode: mode }
    saveState(s)
    applyTopMode(mode)
  })

  ipcMain.on('widget:set-lock', (_, value) => {
    const s = { ...readState(), lockPosition: !!value }
    saveState(s)
    try { win.webContents.send('widget:lock', s.lockPosition) } catch(_){}
  })

  /*
   * 功能：启用/关闭吸附隐藏
   * 参数：value(Boolean)
   * 返回值：无
   * 日期：2025-12-02
   */
  ipcMain.on('widget:set-autohide', (_, value) => {
    const s = { ...readState(), autoHide: !!value }
    saveState(s)
    if (!s.autoHide && s.hidden) {
      try { expandFromEdge() } catch(_){}
    }
  })

  /*
   * 功能：设置把手宽度
   * 参数：value(Number) 4-12
   * 返回值：无
   * 日期：2025-12-02
   */
  ipcMain.on('widget:set-handlewidth', (_, value) => {
    const w = Math.max(4, Math.min(12, Number(value) || 6))
    const s = { ...readState(), handleWidth: w }
    saveState(s)
    try { const st = readState(); win.webContents.send('widget:hidden', !!st.hidden, st.handleWidth) } catch(_){}
  })

  /*
   * 功能：从边缘展开窗口到可见区域
   * 参数：无
   * 返回值：无
   * 日期：2025-12-02
   */
  ipcMain.on('widget:expand', () => { try { expandFromEdge() } catch(_){} })

  // 模拟拖拽逻辑
  let dragStartCursor = null
  let dragStartWin = null
  ipcMain.on('widget:drag-start', () => {
    try {
      dragStartCursor = screen.getCursorScreenPoint()
      dragStartWin = win.getBounds()
    } catch(_){}
  })
  ipcMain.on('widget:dragging', () => {
    try {
      if (!dragStartCursor || !dragStartWin) return
      const cursor = screen.getCursorScreenPoint()
      const dx = cursor.x - dragStartCursor.x
      const dy = cursor.y - dragStartCursor.y
      win.setPosition(dragStartWin.x + dx, dragStartWin.y + dy)
    } catch(_){}
  })
  ipcMain.on('widget:drag-end', () => {
    // 原先的 drag-end 处理已移至下方 unified handler
  })

  ipcMain.on('widget:open-settings', () => openSettingsWindow())

  /*
   * 功能：提供当前微件状态给设置页初始化使用
   * 参数：无
   * 返回值：Object 微件状态（位置、尺寸、透明度、密度、置顶策略、锁定）
   * 日期：2025-12-02
   */
  ipcMain.handle('widget:get-state', async () => {
    try { return readState() } catch(_) { return { width: 360, height: 68, opacity: 0.7, density: 'standard', topMode: 'always', lockPosition: false } }
  })

  // 设置开机自启
  ipcMain.on('widget:set-autolaunch', (_, enabled) => {
    try {
      setAutoLaunch(!!enabled)
      const s = { ...readState(), autoLaunch: !!enabled }
      saveState(s)
    } catch(_){}
  })

  function push() {
    const data = readData()
    if (data) {
      try { win.webContents.send('widget:data', data) } catch (_) {}
      applyTopMode(readState().topMode)
    }
  }

  push()
  try {
    fs.watch(DATA_FILE, { persistent: true }, () => push())
  } catch (_) {}
  pollTimer = setInterval(push, 1000)

  win.on('closed', () => {
    try { clearInterval(pollTimer) } catch (_) {}
    pollTimer = null
    win = null
    try { writeStatus({ running: false, stage: 'closed' }) } catch (_) {}
  })

  // 边缘吸附与弹性动画
  let moveTimer = null
  /**
   * 功能：在移动结束后进行边缘吸附（去抖处理）
   * 参数：无
   * 返回值：无
   * 日期：2025-12-03
   */
  function snapAfterIdle() {
    try {
      const s = readState()
      if (s.lockPosition) return
      const bounds = win.getBounds()
      const display = screen.getDisplayMatching(bounds)
      const { x, y, width, height } = bounds
      const { x: dx, y: dy, width: dw, height: dh } = display.workArea
      const th = 4

      // 死循环修复：如果处于隐藏状态，且位置仍在隐藏区域附近，则保持隐藏，不触发吸附
      if (s.hidden) {
        const handle = s.handleWidth || 6
        const hiddenRight = dx + dw - handle
        const stayHiddenTh = 12

        let isStillHidden = false
        let targetH = x

        if (Math.abs(x - hiddenRight) < stayHiddenTh) {
           isStillHidden = true
           targetH = hiddenRight
        }

        if (isStillHidden) {
            let ny = y
            if (y < dy + th) ny = dy
            if (y + height > dy + dh - th) ny = dy + dh - height
            if (x !== targetH || y !== ny) {
                try { win.setPosition(targetH, ny) } catch(_){}
                saveState({ x: targetH, y: ny })
            }
            return
        }
      }

      // 仅修正垂直越界，横向不做吸附或拉回，避免“弹回原地”
      let ny = y
      if (y < dy + th) ny = dy
      if (y + height > dy + dh - th) ny = dy + dh - height

      // 右侧贴边判定：需接近屏幕边缘(10-20像素范围)
      const snapTh = 20
      const touchingRight = (x + width) >= (dx + dw - snapTh)
      if (!s.hidden && s.autoHide && touchingRight) {
        try { applyAutoHide('right') } catch(err){ console.error(err) }
        return
      }

      // 如仅Y轴需要校正则更新位置与状态
      if (ny !== y) {
        try { win.setPosition(x, ny) } catch(_){}
        saveState({ x, y: ny, width: 360, height: 68, hidden: false, lastEdge: 'none' })
        try { win.webContents.send('widget:hidden', false, s.handleWidth) } catch(_){}
      } else {
        saveState({ x, y, width: 360, height: 68 })
      }
    } catch(_){}
  }
  // 移除 move 事件监听，完全由 drag-end 控制吸附，避免冲突

  try {
    ipcMain.on('widget:drag-end', () => {
      dragStartCursor = null
      dragStartWin = null
      try { snapAfterIdle() } catch(_){}
    })
  } catch(_){}

  /*
   * 功能：把手悬停时切换鼠标穿透以允许系统接收事件
   * 参数：enter(Boolean) 进入把手区域为 true，离开为 false
   * 返回值：无
   * 日期：2025-12-03
   */
  try {
    ipcMain.on('widget:handle-hover', (_, enter) => {
      try {
        const st = readState()
        if (!st.hidden) { win.setIgnoreMouseEvents(false); return }
        if (enter) { win.setIgnoreMouseEvents(false) }
        else { win.setIgnoreMouseEvents(true, { forward: true }) }
      } catch(_){ }
    })
  } catch(_){ }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { app.quit() })

/*
 * 功能：写入微件运行状态文件
 * 参数：patch(Object) 额外状态字段，如 { running:Boolean, stage:String }
 * 返回值：无
 * 日期：2025-12-01
 */
function writeStatus(patch = {}) {
  try {
    ensureDir(DATA_DIR)
    const payload = {
      running: true,
      stage: 'running',
      pid: process.pid,
      updatedAt: Date.now(),
      version: tryGetVersion(),
      ...patch
    }
    fs.writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2))
  } catch (_) {}
}

/*
 * 功能：尝试获取应用版本
 * 参数：无
 * 返回值：String 版本号或 '0.0.0'
 * 日期：2025-12-01
 */
function tryGetVersion() {
  try {
    const { app } = require('electron')
    return app.getVersion() || '0.0.0'
  } catch (_) { return '0.0.0' }
}

// 定期更新状态心跳
setInterval(() => {
  try { writeStatus({}) } catch (_) {}
}, 2000)

/*
 * 功能: 根据模式应用置顶策略
 * 参数: mode(String) 'always'|'work'|'never'
 * 返回值: 无
 * 日期: 2025-12-01
 */
function applyTopMode(mode){
  try {
    if (!win) return
    if (mode === 'never') { win.setAlwaysOnTop(false); return }
    if (mode === 'always') { win.setAlwaysOnTop(true); return }
    // work: 仅有当前任务时置顶
    const data = readData()
    const hasCurrent = !!(data && data.current)
    win.setAlwaysOnTop(!!hasCurrent)
  } catch(_){ }
}

/*
 * 功能：计算窗口当前靠近的屏幕边缘
 * 参数：bounds(Object {x,y,width,height}), workArea(Object {x,y,width,height}), threshold(Number)
 * 返回值：String 'left'|'right'|'top'|'bottom'|'none'
 * 日期：2025-12-02
 */
function getEdge(bounds, workArea, threshold) {
  try {
    const { x, y, width, height } = bounds
    const { x: dx, y: dy, width: dw, height: dh } = workArea
    if (y <= dy + threshold) return 'top'
    if (y + height >= dy + dh - threshold) return 'bottom'
    if (x + width >= dx + dw - threshold) return 'right'
    return 'none'
  } catch(_) { return 'none' }
}

/*
 * 功能：将窗口隐藏到边缘，仅保留把手区域在屏幕内
 * 参数：edge(String) 'left'|'right'
 * 返回值：无
 * 日期：2025-12-02
 */
function applyAutoHide(edge) {
  try {
    if (!win) return
    const st = readState()
    const bounds = win.getBounds()
    const display = screen.getDisplayMatching(bounds)
    const wa = display.workArea
    const handle = Math.max(4, Math.min(12, Number(st.handleWidth) || 6))
    let hx = bounds.x
    let hy = bounds.y
    if (edge === 'right') {
      hx = wa.x + wa.width - handle
    } else {
      return
    }
    // 保存吸附前位置快照
    const next = { x: hx, y: hy, width: bounds.width, height: bounds.height, hidden: true, lastEdge: 'right', preHideX: bounds.x, preHideY: bounds.y }
    try { win.setPosition(hx, hy) } catch(_){}
    saveState({ ...readState(), ...next })
    // 隐藏状态下使窗口允许透传到系统(除把手区域)，同时前端仍能收到鼠标移动事件
    try { win.setIgnoreMouseEvents(true, { forward: true }) } catch(_){}
    try {
      win.webContents.send('widget:edge', edge)
      win.webContents.send('widget:hidden', true, handle)
    } catch(_){}
  } catch(_){}
}

/*
 * 功能：从边缘展开窗口到可见区域
 * 参数：无
 * 返回值：无
 * 日期：2025-12-02
 */
function expandFromEdge() {
  try {
    if (!win) return
    const st = readState()
    if (!st.hidden) return
    const bounds = win.getBounds()
    const display = screen.getDisplayMatching(bounds)
    const wa = display.workArea
    // 恢复吸附前的精确坐标
    let nx = (typeof st.preHideX === 'number') ? st.preHideX : (wa.x + wa.width - bounds.width)
    let ny = (typeof st.preHideY === 'number') ? st.preHideY : bounds.y
    try { win.setPosition(nx, ny) } catch(_){}
    // 清理快照，恢复交互
    const clean = { ...st, x: nx, y: ny, hidden: false, lastEdge: 'none', preHideX: undefined, preHideY: undefined }
    saveState(clean)
    try { win.setIgnoreMouseEvents(false) } catch(_){}
    try { win.webContents.send('widget:hidden', false, st.handleWidth); win.webContents.send('widget:edge', 'none') } catch(_){}
  } catch(_){}
}
