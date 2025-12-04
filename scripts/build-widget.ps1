<#
功能: 一键打包并安装微件到仓库 install 目录
参数:
-ProjectPath [string]: 微件工程路径(可选, 默认为仓库下 widget 目录)
返回值: 无(终端打印 BuiltDir 与 ExePath)
日期: 2025-12-02
#>
param(
    [Parameter(Mandatory = $false)] [string] $ProjectPath
)

try {
    . (Join-Path $PSScriptRoot 'widget_build.ps1')
} catch {
    throw "加载 widget_build.ps1 失败: $($_.Exception.Message)"
}

$result = Invoke-WidgetBuild -ProjectPath $ProjectPath
Write-Host "BuiltDir: $($result.BuiltDir)"
Write-Host "ExePath: $($result.ExePath)"

