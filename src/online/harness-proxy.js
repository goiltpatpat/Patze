import http from 'node:http'
import net from 'node:net'
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000
const COOKIE_PREFIX = 'dsh-auth-'
const COOKIE_PAYLOAD_VERSION = 1

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

function decodeBase64Url(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  return Buffer.from(value.replaceAll('-', '+').replaceAll('_', '/') + padding, 'base64')
}

/**
 * Load or resolve DeepSeek Harness browser session signing secret
 */
export function getDshSigningSecret() {
  const home = process.env.HOME || process.env.USERPROFILE || ''
  const credPath = resolve(home, '.dsh/.credentials.yaml')
  if (existsSync(credPath)) {
    try {
      const content = readFileSync(credPath, 'utf8')
      const match = content.match(/secret:\s*([A-Za-z0-9_-]+)/)
      if (match) {
        return decodeBase64Url(match[1])
      }
    } catch {
      // ignore
    }
  }
  return null
}

/**
 * Mint valid dsh-auth cookie for target authority
 * @param {string} [authority]
 * @returns {string}
 */
export function mintDshAuthCookie(authority = '127.0.0.1:3080') {
  const secret = getDshSigningSecret()
  if (!secret) return ''

  const issuedAt = Date.now()
  const expiresAt = issuedAt + DAY_MILLISECONDS
  const payload = {
    version: COOKIE_PAYLOAD_VERSION,
    authority,
    issuedAt,
    expiresAt,
  }
  const body = encodeBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = createHmac('sha256', secret).update(body).digest()
  const cookieVal = `v1.${body}.${encodeBase64Url(sig)}`
  const cName = COOKIE_PREFIX + encodeBase64Url(createHash('sha256').update(authority).digest())
  return `${cName}=${cookieVal}`
}

/**
 * Proxy HTTP request directly to DeepSeek Harness web server (port 3080)
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {object} options
 * @param {number} [options.targetPort=3080]
 * @param {object} [options.user]
 */
export function proxyToHarness(req, res, options = {}) {
  const targetPort = options.targetPort || 3080
  const user = options.user || null
  const injectNav = options.injectNav !== false
  const dshCookie = mintDshAuthCookie(`127.0.0.1:${targetPort}`)

  const headers = { ...req.headers }
  headers.host = `127.0.0.1:${targetPort}`

  // Rewrite origin and sec-fetch-site to pass DeepSeek Harness CSRF and DNS-rebinding fence
  if (headers.origin) {
    headers.origin = `http://127.0.0.1:${targetPort}`
  }
  if (headers['sec-fetch-site']) {
    headers['sec-fetch-site'] = 'same-origin'
  }
  if (headers.referer) {
    headers.referer = `http://127.0.0.1:${targetPort}/`
  }

  // For root HTML interception, request uncompressed body from upstream
  const urlPath = (req.url || '').split('?')[0]
  if (injectNav && (urlPath === '/' || urlPath === '/index.html')) {
    headers['accept-encoding'] = 'identity'
  }

  if (dshCookie) {
    headers.cookie = headers.cookie ? `${headers.cookie}; ${dshCookie}` : dshCookie
  }

  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers,
  }, (proxyRes) => {
    // Intercept root page to inject the Patze floating status bar.
    const isRootHtml = (urlPath === '/' || urlPath === '/index.html') &&
                       (proxyRes.headers['content-type'] || '').includes('text/html')

    if (isRootHtml && user && injectNav) {
      let body = ''
      proxyRes.setEncoding('utf8')
      proxyRes.on('data', chunk => { body += chunk })
      proxyRes.on('end', () => {
        // Branding and subtle control bar injection
        let modified = body.replace(
          /<title>.*?<\/title>/i,
          `<title>Patze • DeepSeek Agent</title>`
        )

        const isAdmin = user && (user.id === 'pat' || user.role === 'admin')
        const navHtml = `
<div id="patze-hud" style="position:fixed;top:12px;right:16px;z-index:999999;display:flex;align-items:center;gap:12px;background:rgba(15,18,25,0.85);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.12);border-radius:100px;padding:6px 14px;box-shadow:0 10px 30px rgba(0,0,0,0.5);font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;color:#e2e8f0;user-select:none;pointer-events:auto;">
  <div style="display:flex;align-items:center;gap:7px;">
    <svg width="14" height="14" viewBox="0 0 48 48" fill="none" style="vertical-align:middle;">
      <path d="M12 42V10C12 7.79086 13.7909 6 16 6H28C34.6274 6 40 11.3726 40 18C40 24.6274 34.6274 30 28 30H12" stroke="#6366f1" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 28H28C33.5228 28 38 23.5228 38 18C38 12.4772 33.5228 8 28 8H16C14.8954 8 14 8.89543 14 10V40" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="28" cy="18" r="3.5" fill="#38bdf8"/>
    </svg>
    <span style="font-weight:700;letter-spacing:-0.02em;background:linear-gradient(135deg, #ffffff 40%, #94a3b8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Patze</span>
  </div>
  <span style="color:rgba(255,255,255,0.2);">|</span>
  <span style="color:#94a3b8;font-size:11.5px;">User: <strong style="color:#f8fafc;font-weight:600;">${user.name || user.id}</strong></span>
  ${isAdmin ? `
  <span style="color:rgba(255,255,255,0.2);">|</span>
  <a href="/monitor" style="color:#06b6d4;text-decoration:none;font-weight:500;transition:color 0.15s;" onmouseover="this.style.color='#67e8f9'" onmouseout="this.style.color='#06b6d4'">Live Monitor</a>
  ` : ''}
  <span style="color:rgba(255,255,255,0.2);">|</span>
  <a href="/logout" style="color:#ef4444;text-decoration:none;font-weight:500;transition:color 0.15s;" onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='#ef4444'">Logout</a>
</div>
`
        modified = modified.replace('</body>', `${navHtml}</body>`)

        const resHeaders = { ...proxyRes.headers }
        delete resHeaders['content-length']
        delete resHeaders['content-encoding']
        resHeaders['content-type'] = 'text/html; charset=utf-8'

        res.writeHead(proxyRes.statusCode, resHeaders)
        res.end(modified)
      })
      return
    }

    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`
<!DOCTYPE html>
<html>
<head><title>Patze • Backend Starting</title></head>
<body style="background:#090d16;color:#f8fafc;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;max-width:440px;padding:32px;background:#111827;border:1px solid #1f293d;border-radius:16px;">
    <h2 style="margin:0 0 12px 0;">Patze Web Engine Initializing</h2>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;">The DeepSeek Harness engine on port ${targetPort} is starting up or reloading. Please refresh in a few moments.</p>
    <p style="color:#64748b;font-size:12px;font-family:monospace;">${err.message}</p>
    <button onclick="location.reload()" style="margin-top:16px;background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-weight:600;cursor:pointer;">Retry</button>
  </div>
</body>
</html>
`)
    }
  })

  req.pipe(proxyReq)
}

/**
 * Transparent TCP reverse proxy for WebSockets / HTTP Upgrade requests
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:net').Socket} socket
 * @param {Buffer} head
 * @param {number} [targetPort=3080]
 */
export function proxyWebSocketUpgrade(req, socket, head, targetPort = 3080) {
  const dshCookie = mintDshAuthCookie(`127.0.0.1:${targetPort}`)

  const upstream = net.connect(targetPort, '127.0.0.1', () => {
    let headersStr = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`
    let hasCookie = false

    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const name = req.rawHeaders[i]
      let value = req.rawHeaders[i + 1]
      const lower = name.toLowerCase()

      if (lower === 'host') {
        value = `127.0.0.1:${targetPort}`
      } else if (lower === 'origin') {
        value = `http://127.0.0.1:${targetPort}`
      } else if (lower === 'sec-fetch-site') {
        value = 'same-origin'
      } else if (lower === 'referer') {
        value = `http://127.0.0.1:${targetPort}/`
      } else if (lower === 'cookie') {
        hasCookie = true
        if (dshCookie) {
          value = `${value}; ${dshCookie}`
        }
      }
      headersStr += `${name}: ${value}\r\n`
    }

    if (!hasCookie && dshCookie) {
      headersStr += `cookie: ${dshCookie}\r\n`
    }
    headersStr += '\r\n'

    upstream.write(headersStr)
    if (head && head.length > 0) {
      upstream.write(head)
    }

    upstream.pipe(socket)
    socket.pipe(upstream)
  })

  upstream.on('error', () => {
    socket.destroy()
  })

  socket.on('error', () => {
    upstream.destroy()
  })
}
