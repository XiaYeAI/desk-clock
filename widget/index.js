#!/usr/bin/env node
/**
 * 功能: 启动一个本地静态文件服务, 将当前目录下的微件资源(index.html/main.js/style.css等)通过HTTP对外提供
 * 参数: --port <number> 指定监听端口(可选, 默认随机可用端口); --open 自动在默认浏览器打开(可选)
 * 返回值: 无(进程常驻)
 * 日期: 2025-12-01
 */
const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')

/**
 * 功能: 安全拼接并规范化静态资源路径
 * 参数: baseDir[string] 静态资源根目录; reqPath[string] 请求路径
 * 返回值: [string] 实际文件系统路径
 * 日期: 2025-12-01
 */
function resolveStaticPath(baseDir, reqPath) {
  const safePath = path.normalize(reqPath).replace(/^\/+/, '')
  return path.join(baseDir, safePath || 'index.html')
}

/**
 * 功能: 推断文件MIME类型
 * 参数: filePath[string] 文件路径
 * 返回值: [string] MIME类型
 * 日期: 2025-12-01
 */
function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8'
    case '.js': return 'application/javascript; charset=utf-8'
    case '.css': return 'text/css; charset=utf-8'
    case '.png': return 'image/png'
    case '.svg': return 'image/svg+xml'
    case '.ico': return 'image/x-icon'
    default: return 'application/octet-stream'
  }
}

/**
 * 功能: 启动HTTP静态服务
 * 参数: root[string] 静态根目录; port[number] 端口(可选, 0表示随机端口)
 * 返回值: [Promise<{server: http.Server, port: number}>] 启动成功的服务与端口
 * 日期: 2025-12-01
 */
function startStaticServer(root, port = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const filePath = resolveStaticPath(root, decodeURIComponent(req.url))
      fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('Not Found')
          return
        }
        const mime = getMime(filePath)
        res.writeHead(200, { 'Content-Type': mime })
        fs.createReadStream(filePath).pipe(res)
      })
    })
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      resolve({ server, port: server.address().port })
    })
  })
}

/**
 * 功能: 在默认浏览器打开指定URL
 * 参数: url[string] 需要打开的地址
 * 返回值: 无
 * 日期: 2025-12-01
 */
function openDefaultBrowser(url) {
  const platform = os.platform()
  if (platform === 'win32') {
    require('child_process').spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref()
  } else if (platform === 'darwin') {
    require('child_process').spawn('open', [url], { stdio: 'ignore', detached: true }).unref()
  } else {
    require('child_process').spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref()
  }
}

/**
 * 功能: 解析命令行参数
 * 参数: 无
 * 返回值: [object] { port?: number, open?: boolean }
 * 日期: 2025-12-01
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const out = { port: 0, open: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--open') out.open = true
    else if (a === '--port') {
      const v = Number(args[i + 1])
      if (!Number.isNaN(v)) out.port = v
      i++
    }
  }
  return out
}

;(async () => {
  const { port, open } = parseArgs()
  const root = __dirname
  try {
    const { port: listenPort } = await startStaticServer(root, port)
    const url = `http://127.0.0.1:${listenPort}/index.html`
    console.log(`[desk-clock-widget] serving at ${url}`)
    if (open) openDefaultBrowser(url)
  } catch (e) {
    console.error('[desk-clock-widget] failed to start server:', e.message || e)
    process.exit(1)
  }
})()

