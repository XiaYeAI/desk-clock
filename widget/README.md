# DeskClock 桌面微件

## 运行方式（Windows，PowerShell）
- 安装 Node.js（如未安装）
- 在项目根目录执行：
  - `npx electron ./widget/main.js`
- 首次运行会自动在 `用户目录/DeskClock/` 下创建：
  - `current_task.json`（由插件写入）
  - `widget_state.json`（位置与尺寸）
 - 默认启用“开机自启”，如需关闭请编辑 `widget_state.json` 将 `autoLaunch` 设为 `false`

## 数据文件结构
```json
{
  "current": { "name": "任务名", "hhmm": "09:30", "elapsed": 12 },
  "next": { "name": "任务名", "hhmm": "10:00", "remaining": 30 },
  "updatedAt": 1733030400000
}
```

## 窗口特性
- 置顶透明、无边框
- 可拖动并记住位置
- 实时监听 `current_task.json` 并更新
- 居中显示当前任务名称，字号加大、居中对齐
