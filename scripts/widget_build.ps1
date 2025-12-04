function Build-ElectronWidget {
# Function: Build Electron widget using electron-packager
# Params: -ProjectPath [string] path to widget project
# Returns: [string] path to built directory (win32-x64)
# Date: 2025-12-02
    param(
        [Parameter(Mandatory = $true)] [string] $ProjectPath
    )

    if (-not (Test-Path -Path $ProjectPath)) { throw "Project path not found: $ProjectPath" }
    $outDirBase = Join-Path $ProjectPath 'release_packaged'
    $outDir = Join-Path $ProjectPath ("release_packaged_" + (Get-Date).ToString("yyyyMMddHHmmss"))

    Push-Location $ProjectPath
    try {
        $cmd = "npx --yes electron-packager . DeskClockWidget --platform=win32 --arch=x64 --out `"$outDir`" --overwrite --ignore=release --ignore=release_packaged --ignore=install --ignore=scripts"
        & powershell -NoProfile -Command $cmd
    } finally { Pop-Location }

    $built = Join-Path $outDir 'DeskClockWidget-win32-x64'
    if (-not (Test-Path -Path $built)) { throw "Build failed: $built not found" }
    return $built
}

function Install-ElectronWidget {
# Function: Copy built widget to repository install directory
# Params: -BuiltDir [string] built directory path
# Returns: [string] target exe full path
# Date: 2025-12-02
    param(
        [Parameter(Mandatory = $true)] [string] $BuiltDir
    )

    if (-not (Test-Path -Path $BuiltDir)) { throw "Built dir not found: $BuiltDir" }
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    $targetDir = Join-Path $repoRoot 'install\desk-clock-widget'
    if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
    Copy-Item -Path (Join-Path $BuiltDir '*') -Destination $targetDir -Recurse -Force -ErrorAction Continue
    $exe = Join-Path $targetDir 'DeskClockWidget.exe'
    if (-not (Test-Path -Path $exe)) { throw "Install failed: exe not found in $targetDir" }
    try { $hash = (Get-FileHash -Path $exe -Algorithm SHA256).Hash; Write-Host "Installed: $exe"; Write-Host "SHA256: $hash" } catch {}
    return $exe
}

function Prune-ElectronWidgetDependencies {
# 功能: 精简Electron运行目录以减小体积(保留必要依赖)
# 参数: -TargetDir [string] 安装后的Electron运行目录
# 返回值: 无
# 日期: 2025-12-02
    param(
        [Parameter(Mandatory = $true)] [string] $TargetDir
    )

    if (-not (Test-Path -Path $TargetDir)) { throw "Target dir not found: $TargetDir" }

    # 删除非必要语言包, 保留 zh-CN 与 en-US
    $locales = Join-Path $TargetDir 'locales'
    if (Test-Path $locales) {
        Get-ChildItem -Path $locales -Filter '*.pak' -File | ForEach-Object {
            $name = $_.Name.ToLower()
            if ($name -ne 'zh-cn.pak' -and $name -ne 'en-us.pak') {
                try { Remove-Item -Path $_.FullName -Force } catch {}
            }
        }
    }

    # 删除崩溃上报程序(可选, 不影响运行)
    $crashpad = Join-Path $TargetDir 'crashpad_handler.exe'
    if (Test-Path $crashpad) { try { Remove-Item -Path $crashpad -Force } catch {} }

    # 删除PDF相关动态库(不使用打印为PDF功能时可移除)
    $pdfdll = Join-Path $TargetDir 'pdf.dll'
    if (Test-Path $pdfdll) { try { Remove-Item -Path $pdfdll -Force } catch {} }

    # 保留说明: 下列文件为必需, 不进行移除
    # - icudtl.dat, v8_context_snapshot.bin, snapshot_blob.bin, resources.pak
    # - libEGL.dll, libGLESv2.dll, d3dcompiler_47.dll, ffmpeg.dll(音频/MP3解码)
    # - chrome_elf.dll
    Write-Host "Prune completed: $TargetDir"
}

function Invoke-WidgetBuild {
# Function: Build and install widget in one step
# Params: -ProjectPath [string] path to widget project
# Returns: [hashtable] { BuiltDir, ExePath }
# Date: 2025-12-02
    param(
        [Parameter(Mandatory = $false)] [string] $ProjectPath
    )
    if (-not $ProjectPath -or $ProjectPath.Trim().Length -eq 0) { $ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot '..\widget')).Path }
    try { Stop-Process -Name 'DeskClockWidget' -Force -ErrorAction SilentlyContinue } catch {}
    $built = Build-ElectronWidget -ProjectPath $ProjectPath
    $exe = Install-ElectronWidget -BuiltDir $built
    # 精简依赖
    try { Prune-ElectronWidgetDependencies -TargetDir (Split-Path -Path $exe -Parent) } catch {}
    return @{ BuiltDir = $built; ExePath = $exe }
}
