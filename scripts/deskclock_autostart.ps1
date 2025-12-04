function Get-StartupFolderPath {
<#
功能: 获取当前用户的 Windows 启动目录路径
参数: 无
返回值: [string] 启动目录完整路径
日期: 2025-12-01
#>
    $startup = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
    return $startup
}

function New-DeskClockWidgetStartupShortcut {
<#
功能: 在启动目录创建微件的快捷方式, 实现开机自启
参数:
-WidgetExePath [string]: 微件可执行文件路径 (必须为绝对路径)
-Arguments [string]: 启动参数 (可选, 默认空)
-WorkingDirectory [string]: 工作目录 (可选, 默认为可执行文件所在目录)
-ShortcutName [string]: 快捷方式名称 (可选, 默认 'DeskClockWidget.lnk')
返回值: [string] 已创建的快捷方式完整路径
日期: 2025-12-01
#>
    param(
        [Parameter(Mandatory = $true)] [string] $WidgetExePath,
        [Parameter(Mandatory = $false)] [string] $Arguments = "",
        [Parameter(Mandatory = $false)] [string] $WorkingDirectory,
        [Parameter(Mandatory = $false)] [string] $ShortcutName = "DeskClockWidget.lnk"
    )

    if (-not (Test-Path -Path $WidgetExePath)) {
        throw "微件可执行文件不存在: $WidgetExePath"
    }

    if (-not $WorkingDirectory -or $WorkingDirectory.Trim().Length -eq 0) {
        $WorkingDirectory = Split-Path -Path $WidgetExePath -Parent
    }

    $startup = Get-StartupFolderPath
    $shortcutPath = Join-Path $startup $ShortcutName

    $shell = New-Object -ComObject WScript.Shell
    $sc = $shell.CreateShortcut($shortcutPath)
    $sc.TargetPath = $WidgetExePath
    $sc.Arguments = $Arguments
    $sc.WorkingDirectory = $WorkingDirectory
    $sc.WindowStyle = 7
    $sc.IconLocation = "$WidgetExePath,0"
    $sc.Save()

    return $shortcutPath
}

function Remove-DeskClockWidgetStartupShortcut {
<#
功能: 从启动目录移除微件的快捷方式
参数:
-ShortcutName [string]: 快捷方式名称 (可选, 默认 'DeskClockWidget.lnk')
返回值: [bool] 是否成功移除
日期: 2025-12-01
#>
    param(
        [Parameter(Mandatory = $false)] [string] $ShortcutName = "DeskClockWidget.lnk"
    )

    $startup = Get-StartupFolderPath
    $shortcutPath = Join-Path $startup $ShortcutName

    if (Test-Path -Path $shortcutPath) {
        Remove-Item -Path $shortcutPath -Force
        return $true
    }
    else {
        return $false
    }
}

function Test-DeskClockWidgetStartupShortcut {
<#
功能: 检查启动目录内微件快捷方式是否存在
参数:
-ShortcutName [string]: 快捷方式名称 (可选, 默认 'DeskClockWidget.lnk')
返回值: [bool] 是否存在快捷方式
日期: 2025-12-01
#>
    param(
        [Parameter(Mandatory = $false)] [string] $ShortcutName = "DeskClockWidget.lnk"
    )

    $startup = Get-StartupFolderPath
    $shortcutPath = Join-Path $startup $ShortcutName
    return (Test-Path -Path $shortcutPath)
}

