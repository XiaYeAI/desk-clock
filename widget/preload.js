/*
 * 功能：Renderer 与主进程的桥接，提供数据接收与位置存储
 * 参数：无
 * 返回值：无
 * 创建日期：2025-12-01
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('widgetAPI', {
  onData: (cb) => {
    try { ipcRenderer.on('widget:data', (_, data) => cb && cb(data)) } catch (_) {}
  },
  onLock: (cb) => {
    try { ipcRenderer.on('widget:lock', (_, locked) => cb && cb(!!locked)) } catch (_) {}
  },
  onDensity: (cb) => {
    try { ipcRenderer.on('widget:density', (_, density) => cb && cb(density)) } catch (_) {}
  },
  onEdge: (cb) => {
    try { ipcRenderer.on('widget:edge', (_, edge) => cb && cb(edge)) } catch (_) {}
  },
  onHidden: (cb) => {
    try { ipcRenderer.on('widget:hidden', (_, hidden, handleWidth) => cb && cb(hidden, handleWidth)) } catch (_) {}
  },
  savePosition: (pos) => {
    try { ipcRenderer.send('widget:save-position', pos) } catch (_) {}
  },
  openSettings: () => {
    try { ipcRenderer.send('widget:open-settings') } catch (_) {}
  },
  openContextMenu: () => {
    try { ipcRenderer.send('widget:context-menu') } catch (_) {}
  },
  expand: () => {
    try { ipcRenderer.send('widget:expand') } catch (_) {}
  },
  startDrag: () => {
    try { ipcRenderer.send('widget:drag-start') } catch (_) {}
  },
  dragging: () => {
    try { ipcRenderer.send('widget:dragging') } catch (_) {}
  },
  endDrag: () => {
    try { ipcRenderer.send('widget:drag-end') } catch (_) {}
  },
  setOpacity: (value) => {
    try { ipcRenderer.send('widget:set-opacity', value) } catch (_) {}
  },
  setDensity: (value) => {
    try { ipcRenderer.send('widget:set-density', value) } catch (_) {}
  },
  setTopMode: (value) => {
    try { ipcRenderer.send('widget:set-topmode', value) } catch (_) {}
  },
  setLockPosition: (value) => {
    try { ipcRenderer.send('widget:set-lock', value) } catch (_) {}
  },
  setAutoHide: (value) => {
    try { ipcRenderer.send('widget:set-autohide', value) } catch (_) {}
  },
  setHandleWidth: (value) => {
    try { ipcRenderer.send('widget:set-handlewidth', value) } catch (_) {}
  },
  /*
   * 功能：通知主进程把手悬停状态以切换鼠标穿透
   * 参数：enter(Boolean) 进入为 true，离开为 false
   * 返回值：无
   * 日期：2025-12-03
   */
  hoverHandle: (enter) => {
    try { ipcRenderer.send('widget:handle-hover', !!enter) } catch(_){ }
  }
})
