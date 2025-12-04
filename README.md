# 桌面闹钟 uTools 插件

这是一个简洁高效的时间管理 uTools 插件。通过设置每天的时间安排，插件会在指定时间通过弹窗提醒你该做什么事情，帮助你更好地规划和管理时间。

## 功能特点

- 自定义时间段设置：灵活设置每天的时间安排
- 智能任务提醒：到点自动弹窗提醒，不错过重要事项
- 数据本地持久化：时间安排数据本地保存，无需重复设置
- 简洁的用户界面：清晰直观的操作面板，易于上手
- 自定义通知样式：可设置通知窗口的头像

## 使用方法

1. 在 uTools 中安装该插件
2. 通过关键词「桌面闹钟」「闹钟」「时间管理」等打开插件
3. 点击「创建时间块」标签添加新的时间块
4. 设置时间和对应的任务内容
5. 可选择通知窗口样式和提醒方式
6. 点击「保存设置」保存你的时间安排

## 注意事项

- 插件会在后台持续运行，保证准时提醒，建议不要主动关闭插件，让它后台运行即可

## 反馈建议

如果在使用过程中遇到问题或有改进建议，欢迎通过 uTools 插件中心反馈。

## 1.0.1
修复两个问题：
- 头像设置不生效问题
- 提醒时间为整点时，预提醒不能生效

## 1.0.4
修复和优化：
- 修复添加时间块没有反应的问题
- 新增提醒次数设置功能，支持永久提醒或指定次数提醒
- 实现当前任务高亮显示，优化任务识别逻辑
- 改进用户界面，防止文本溢出并增强实时更新
- 添加每分钟自动刷新机制确保任务状态准确显示

## 微件（悬浮窗）使用说明

- 打包微件
  - 在仓库根目录执行：
    - `. .\scripts\widget_build.ps1`
    - `Invoke-WidgetBuild`
  - 成功后生成 `install\desk-clock-widget\DeskClockWidget.exe` 并打印 `SHA256` 校验值。

- 运行微件
  - `\.\install\desk-clock-widget\DeskClockWidget.exe`
  - 窗口为无框透明置顶，显示当前任务名称，并与插件保持心跳通信。

- 开机自启快捷方式（可选）
  - 加载脚本：`. .\scripts\deskclock_autostart.ps1`
  - 创建快捷方式：
    - `New-DeskClockWidgetStartupShortcut -WidgetExePath (Resolve-Path .\install\desk-clock-widget\DeskClockWidget.exe).Path -Arguments '--minimized'`
  - 如需移除：`Remove-DeskClockWidgetStartupShortcut`

- 常见问题
  - 构建失败或提示文件占用：先结束微件进程 `taskkill /IM DeskClockWidget.exe /F` 后重试 `Invoke-WidgetBuild`
  - 打包后未出现悬浮窗：运行 `DeskClockWidget.exe`，确认 `C:\Users\<用户名>\DeskClock\status.json` 心跳更新
  - 需要调整透明度、置顶策略等：点击悬浮窗右上角齿轮进入设置页
