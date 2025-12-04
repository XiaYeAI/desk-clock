@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

:: 核心文件列表
set CORE_FILES=index.html style.css preload.js logo.png notification.html plugin.json logo.svg script.js

:: 创建目标目录
if not exist dist mkdir dist

:: 复制核心文件
echo 正在复制核心文件...
for %%f in (%CORE_FILES%) do (
    if exist "%%f" (
        xcopy /y "%%f" "dist\" >nul
    ) else (
        echo 警告: 缺失核心文件 %%f
    )
)

:: 创建排除列表
echo .md$>exclude.txt
echo .bak$>>exclude.txt

del exclude.txt

:: 文件校验
echo.
echo 文件校验结果：
for /r dist %%f in (*) do (
    CertUtil -hashfile "%%f" MD5
)

echo.
echo 构建完成，有效文件已复制到 dist 目录
echo.
echo 正在打包微件...
if exist "scripts\build-widget.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-widget.ps1"
    if %ERRORLEVEL% NEQ 0 (
        echo 微件打包失败，请检查依赖或脚本
    ) else (
        echo 微件打包完成，已生成 install\desk-clock-widget\DeskClockWidget.exe
    )
) else (
    echo 未找到 scripts\build-widget.ps1，跳过微件打包
)
endlocal
