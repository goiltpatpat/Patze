import { createServer } from 'node:http'
import { parse as parseUrl } from 'node:url'
import { AuthService } from './auth.js'
import { DeviceRegistry } from './registry.js'
import { TunnelManager } from './tunnel.js'
import { renderDashboardHtml, renderLoginHtml } from './ui.js'
import { proxyToHarness, proxyWebSocketUpgrade } from './harness-proxy.js'
import { MonitorTracker, renderMonitorHtml } from './monitor.js'

const MAX_REQUEST_BODY_BYTES = 1024 * 1024
const MAX_TUNNEL_FRAME_BYTES = 16 * 1024 * 1024
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1'])

/**
 * Patze Online Control Plane Server (Alpha)
 *
 * Responsibilities:
 * - User Authentication & Session state
 * - Device Registration & strict Ownership gating
 * - Device Presence tracking (real-time, zero fabrication)
 * - Inbound Reverse Tunnel management from Local Hosts
 * - Authenticated routing from browser to the user's Local Host
 * - Zero agent execution in the cloud
 */
export class PatzeOnlineServer {
  /**
   * @param {object} [options]
   * @param {number} [options.port]
   * @param {string} [options.host]
   * @param {boolean} [options.secureCookies]
   * @param {number} [options.heartbeatTimeoutMs]
   * @param {number} [options.harnessPort]
   */
  constructor(options = {}) {
    this.port = options.port !== undefined ? options.port : 4000
    this.host = options.host || process.env.PATZE_ONLINE_HOST || '127.0.0.1'
    if (!LOOPBACK_HOSTS.has(this.host.toLowerCase())) {
      throw new Error('Patze Online binds to loopback only; use a TLS reverse proxy for network access.')
    }
    this.secureCookies = options.secureCookies ?? process.env.PATZE_ONLINE_SECURE_COOKIES === 'true'
    this.harnessPort = options.harnessPort || 3080

    this.auth = new AuthService(options.authUsers)
    this.registry = new DeviceRegistry({ heartbeatTimeoutMs: options.heartbeatTimeoutMs || 10000 })
    this.tunnel = new TunnelManager(this.registry)
    this.monitor = new MonitorTracker()

    this.server = createServer((req, res) => this._handleRequest(req, res))

    // Handle WebSocket / HTTP Upgrade requests to DeepSeek Harness
    this.server.on('upgrade', (req, socket, head) => {
      const auth = this.auth.authenticateRequest(req)
      if (!auth?.user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
      if (auth.user.id !== 'pat' && auth.user.role !== 'admin') {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
        socket.destroy()
        return
      }
      proxyWebSocketUpgrade(req, socket, head, this.harnessPort)
    })
  }

  /**
   * Start listening
   * @returns {Promise<{ port: number, host: string, url: string }>}
   */
  async listen() {
    if (!this.auth.hasConfiguredCredentials()) {
      throw new Error('Patze Online requires at least one configured user password and pairing secret. Configure PATZE_<USER>_PASSWORD and PATZE_<USER>_PAIRING_SECRET.')
    }
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, this.host, () => {
        const address = this.server.address()
        const actualPort = typeof address === 'object' && address ? address.port : this.port
        const urlHost = this.host.includes(':') ? `[${this.host}]` : this.host
        const url = `http://${urlHost}:${actualPort}`
        resolve({ port: actualPort, host: this.host, url })
      })
      this.server.on('error', reject)
    })
  }

  /**
   * Graceful close
   */
  async close() {
    this.registry.dispose()
    return new Promise((resolve) => {
      this.server.close(() => resolve())
    })
  }

  async _dispatchToDevice(deviceId, userId, request) {
    const startedAt = Date.now()
    try {
      const response = await this.tunnel.dispatchToDevice(deviceId, request)
      this.monitor.recordTask({
        userId,
        deviceId,
        status: response.status >= 400 ? 'FAILED' : 'SUCCESS',
        durationMs: Date.now() - startedAt,
      })
      return response
    } catch (error) {
      this.monitor.recordTask({
        userId,
        deviceId,
        status: 'FAILED',
        durationMs: Date.now() - startedAt,
      })
      throw error
    }
  }

  /**
   * Main request dispatcher
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  async _handleRequest(req, res) {
    const parsed = parseUrl(req.url || '/', true)
    const path = parsed.pathname || '/'
    const method = (req.method || 'GET').toUpperCase()

    // Helper: JSON response
    const sendJson = (status, data, extraHeaders = {}) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        ...extraHeaders,
      })
      res.end(JSON.stringify(data))
    }

    // Helper: read body (JSON or form-urlencoded)
    const readBody = async (maxBytes = MAX_REQUEST_BODY_BYTES) => {
      return new Promise((resolve, reject) => {
        const tooLargeError = () => Object.assign(new Error(`Request body exceeds the ${maxBytes / (1024 * 1024)} MiB limit`), {
          code: 'PAYLOAD_TOO_LARGE',
          status: 413,
        })
        const contentLength = Number(req.headers['content-length'])
        if (Number.isFinite(contentLength) && contentLength > maxBytes) {
          req.on('error', reject)
          req.resume()
          return reject(tooLargeError())
        }

        const chunks = []
        let totalBytes = 0
        let tooLarge = false
        req.on('data', chunk => {
          totalBytes += chunk.length
          if (totalBytes > maxBytes) {
            if (!tooLarge) {
              tooLarge = true
              chunks.length = 0
              reject(tooLargeError())
              req.resume()
            }
            return
          }
          if (!tooLarge) chunks.push(chunk)
        })
        req.on('end', () => {
          if (tooLarge) return reject(tooLargeError())
          if (totalBytes === 0) return resolve({})
          const raw = Buffer.concat(chunks).toString('utf8')
          const contentType = req.headers['content-type'] || ''
          if (contentType.includes('application/x-www-form-urlencoded')) {
            try {
              const params = new URLSearchParams(raw)
              const obj = {}
              for (const [key, value] of params.entries()) {
                obj[key] = value
              }
              return resolve(obj)
            } catch (err) {
              return reject(new Error('Invalid form body'))
            }
          }
          try {
            resolve(JSON.parse(raw))
          } catch (err) {
            reject(new Error('Invalid JSON body'))
          }
        })
        req.on('error', reject)
      })
    }

    try {
      // 1. Health check
      if (path === '/health') {
        return sendJson(200, { status: 'healthy', service: 'patze-online', time: Date.now() })
      }

      // Login page: GET /login
      if (path === '/login' && method === 'GET') {
        const auth = this.auth.authenticateRequest(req)
        if (auth?.user) {
          res.writeHead(302, { Location: '/' })
          return res.end()
        }
        const error = parsed.query?.error ? String(parsed.query.error) : null
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        return res.end(renderLoginHtml({ error }))
      }

      // Login action: POST /api/auth/login
      if (path === '/api/auth/login' && method === 'POST') {
        const body = await readBody()
        const { username, password } = body
        const validUser = this.auth.verifyCredentials(username, password)
        const isJson = (req.headers['accept'] || '').includes('application/json') ||
                       (req.headers['content-type'] || '').includes('application/json')

        if (!validUser) {
          if (isJson) {
            return sendJson(401, { error: 'INVALID_CREDENTIALS', message: 'Invalid username or password' })
          }
          res.writeHead(302, { Location: '/login?error=Invalid%20username%20or%20password' })
          return res.end()
        }

        const session = this.auth.createSession(validUser.id)
        const sessionToken = session.token
        const secureCookie = this.secureCookies ? '; Secure' : ''
        const cookieHeader = `patze_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${secureCookie}; Max-Age=86400`

        if (isJson) {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': cookieHeader,
          })
          return res.end(JSON.stringify({ ok: true, user: validUser, token: sessionToken }))
        }

        res.writeHead(302, {
          Location: '/',
          'Set-Cookie': cookieHeader,
        })
        return res.end()
      }

      // Logout: GET /logout or POST /api/auth/logout
      if ((path === '/logout' && method === 'GET') || (path === '/api/auth/logout' && method === 'POST')) {
        const auth = this.auth.authenticateRequest(req)
        if (auth?.token) {
          this.auth.destroySession(auth.token)
        }
        res.writeHead(302, {
          Location: '/login',
          'Set-Cookie': `patze_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${this.secureCookies ? '; Secure' : ''}`,
        })
        return res.end()
      }

      // Bootstrap exchange: GET /auth/bootstrap?token=boot_...
      // Consumes one-time bootstrap token and issues HttpOnly session cookie, redirecting to /
      if (path === '/auth/bootstrap' && method === 'GET') {
        const bootToken = parsed.query?.token
        const session = this.auth.consumeBootstrapToken(bootToken)
        if (session) {
          const sessionToken = session.token
          res.writeHead(302, {
            Location: '/',
            'Set-Cookie': `patze_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${this.secureCookies ? '; Secure' : ''}; Max-Age=86400`,
          })
          return res.end()
        }
        res.writeHead(302, {
          Location: '/login?error=Invalid%20or%20expired%20bootstrap%20token',
        })
        return res.end()
      }

      // Create bootstrap token (for CLI pairing): POST /api/auth/bootstrap
      if (path === '/api/auth/bootstrap' && method === 'POST') {
        const body = await readBody()
        const { userId, secret } = body
        if (!this.auth.verifyPairingSecret(userId, secret)) {
          return sendJson(401, { error: 'UNAUTHORIZED', message: 'Invalid pairing secret' })
        }
        const bootstrapToken = this.auth.createBootstrapToken(userId)
        return sendJson(200, {
          ok: true,
          bootstrapToken,
          loginUrl: `/auth/bootstrap?token=${bootstrapToken}`,
        })
      }

      // 2. Local Host Pairing Endpoint (Outbound Local Host -> Patze Online)
      // POST /api/devices/pair
      if (path === '/api/devices/pair' && method === 'POST') {
        const body = await readBody()
        const { userId, deviceId, deviceName, secret, platform, arch, hostVersion, allowedWorkspaces } = body

        if (!this.auth.verifyPairingSecret(userId, secret)) {
          return sendJson(401, { error: 'UNAUTHORIZED', message: 'Invalid pairing secret for user' })
        }

        const device = this.registry.registerDevice({
          deviceId,
          userId,
          deviceName,
          platform,
          arch,
          hostVersion,
          allowedWorkspaces,
        })

        return sendJson(200, {
          ok: true,
          message: 'Device successfully paired and registered',
          device: {
            deviceId: device.deviceId,
            userId: device.userId,
            deviceName: device.deviceName,
            status: device.status,
          },
        })
      }

      // 3. Local Host Inbound Reverse Tunnel Endpoint
      // POST /tunnel/connect
      if (path === '/tunnel/connect' && method === 'POST') {
        const metadata = await readBody()
        const deviceId = /** @type {string} */ (req.headers['x-patze-device-id'])
        const userId = /** @type {string} */ (req.headers['x-patze-user-id'])
        const secret = /** @type {string} */ (req.headers['x-patze-device-secret'])

        if (!this.auth.verifyPairingSecret(userId, secret)) {
          return sendJson(401, { error: 'UNAUTHORIZED', message: 'Invalid device credentials' })
        }

        let check = this.registry.getDeviceForUser(deviceId, userId)
        if (!check.ok) {
          this.registry.registerDevice({
            deviceId,
            userId,
            deviceName: metadata.deviceName || `${userId.toUpperCase()} PC`,
            platform: metadata.platform,
            arch: metadata.arch,
            allowedWorkspaces: metadata.allowedWorkspaces,
          })
          check = this.registry.getDeviceForUser(deviceId, userId)
        }
        if (!check.ok) {
          return sendJson(check.status, { error: check.error })
        }

        // Keep connection open for long-lived NDJSON streaming downlink
        this.tunnel.acceptTunnel({
          deviceId,
          userId,
          req,
          res,
          metadata: {
            platform: metadata.platform,
            arch: metadata.arch,
            allowedWorkspaces: metadata.allowedWorkspaces,
          },
        })
        return
      }

      // 4. Local Host Uplink Response Frame Endpoint
      // POST /tunnel/uplink
      if (path === '/tunnel/uplink' && method === 'POST') {
        const body = await readBody(MAX_TUNNEL_FRAME_BYTES)
        const { deviceId, userId, secret, frame } = body

        if (!this.auth.verifyPairingSecret(userId, secret)) {
          return sendJson(401, { error: 'UNAUTHORIZED', message: 'Invalid device credentials' })
        }

        const result = this.tunnel.handleUplinkFrame(deviceId, userId, frame)
        return sendJson(result.ok ? 200 : 400, result)
      }

      // -------------------------------------------------------------
      // Authenticated User Area (Dashboard & Browser API)
      // -------------------------------------------------------------
      const auth = this.auth.authenticateRequest(req)
      const user = auth ? auth.user : null

      // Static assets for DeepSeek Harness Web UI
      if (path.startsWith('/assets/') || path === '/favicon.svg' || path === '/favicon-dark.svg' || path === '/manifest.webmanifest') {
        if (!user) return sendJson(401, { error: 'UNAUTHORIZED', message: 'Authentication required' })
        if (user.id !== 'pat' && user.role !== 'admin') {
          return sendJson(403, { error: 'FORBIDDEN', message: 'Shared DeepSeek Harness access is restricted to admin' })
        }
        return proxyToHarness(req, res, { targetPort: this.harnessPort, user, injectNav: false })
      }

      // Root path: Only admin can use the shared DeepSeek Harness Web UI.
      if (path === '/') {
        if (!user) {
          res.writeHead(302, { Location: '/login' })
          return res.end()
        }
        if (user.id !== 'pat' && user.role !== 'admin') {
          res.writeHead(302, { Location: '/dashboard' })
          return res.end()
        }
        return proxyToHarness(req, res, { targetPort: this.harnessPort, user, injectNav: true })
      }

      // Dedicated Device Control Plane View
      if (path === '/dashboard') {
        if (!user) {
          res.writeHead(302, { Location: '/login' })
          return res.end()
        }
        const userDevices = this.registry.listDevicesForUser(user.id)
        const html = renderDashboardHtml({
          user,
          devices: userDevices,
        })
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
        })
        return res.end(html)
      }

      // Operational Monitor View: GET /monitor (Restricted to owner/admin: pat)
      if (path === '/monitor' && method === 'GET') {
        if (!user) {
          res.writeHead(302, { Location: '/login' })
          return res.end()
        }
        if (user.id !== 'pat' && user.role !== 'admin') {
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
          return res.end('Forbidden: Operational Monitor is restricted to admin (pat).')
        }
        const snapshot = this.monitor.getSnapshot(this.registry, this.auth)
        const html = renderMonitorHtml(snapshot, user)
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
        })
        return res.end(html)
      }

      // Operational Monitor API: GET /api/monitor/stats (Restricted to owner/admin: pat)
      if (path === '/api/monitor/stats' && method === 'GET') {
        if (!user) return sendJson(401, { error: 'UNAUTHORIZED', message: 'Authentication required' })
        if (user.id !== 'pat' && user.role !== 'admin') {
          return sendJson(403, { error: 'FORBIDDEN', message: 'Operational monitor restricted to admin' })
        }
        const snapshot = this.monitor.getSnapshot(this.registry, this.auth)
        return sendJson(200, snapshot)
      }

      // User API: List own registered devices
      // GET /api/devices
      if (path === '/api/devices' && method === 'GET') {
        if (!user) return sendJson(401, { error: 'UNAUTHORIZED', message: 'Authentication required' })
        const devices = this.registry.listDevicesForUser(user.id)
        return sendJson(200, { ok: true, userId: user.id, devices })
      }

      // User API: Full Agent Chat & Execution Endpoint (Zero configuration required)
      // POST /api/chat
      if (path === '/api/chat' && method === 'POST') {
        if (!user) return sendJson(401, { error: 'UNAUTHORIZED', message: 'Authentication required' })
        const body = await readBody()
        const userDevices = this.registry.listDevicesForUser(user.id)
        let targetDevice = null

        if (body.deviceId) {
          const check = this.registry.getDeviceForUser(body.deviceId, user.id)
          if (check.ok && check.device.status === 'online') {
            targetDevice = check.device
          }
        }

        if (!targetDevice) {
          targetDevice = userDevices.find(d => d.status === 'online') || userDevices[0]
        }

        if (!targetDevice || targetDevice.status !== 'online') {
          return sendJson(503, {
            error: 'DEVICE_OFFLINE',
            message: `No active physical host is currently connected for account [${user.id}]. Start your host daemon: node bin/patze.js host`,
          })
        }

        const workspace = body.workspace || targetDevice.allowedWorkspaces?.[0] || 'default'
        const prompt = body.prompt || body.message || ''

        try {
          const response = await this._dispatchToDevice(targetDevice.deviceId, user.id, {
            method: 'POST',
            path: '/local/execute',
            headers: { 'Content-Type': 'application/json' },
            body: {
              workspace,
              prompt,
              requestedBy: user.id,
              model: body.model || 'deepseek-v3',
            },
          })
          return sendJson(response.status || 200, response.body || {})
        } catch (err) {
          const status = err.status || 500
          return sendJson(status, {
            error: err.code || 'DISPATCH_ERROR',
            message: err.message,
          })
        }
      }

      // User API: Execute agent task on a target local device
      // POST /api/devices/:deviceId/execute
      const execMatch = path.match(/^\/api\/devices\/([^/]+)\/execute$/)
      if (execMatch && method === 'POST') {
        if (!user) return sendJson(401, { error: 'UNAUTHORIZED', message: 'Authentication required' })
        const targetDeviceId = decodeURIComponent(execMatch[1])

        // 🛡️ CRITICAL SECURITY GATE 1: Server-Side Ownership Check
        const deviceCheck = this.registry.getDeviceForUser(targetDeviceId, user.id)
        if (!deviceCheck.ok) {
          // Strict 403 when device belongs to another user
          return sendJson(deviceCheck.status, {
            error: 'CROSS_USER_ACCESS_DENIED',
            message: deviceCheck.error,
          })
        }

        const device = deviceCheck.device

        // 🛡️ CRITICAL SECURITY GATE 2: True Presence Check (NO Fallback!)
        if (device.status !== 'online') {
          return sendJson(503, {
            error: 'DEVICE_OFFLINE',
            message: `Device [${targetDeviceId}] is currently offline. Refusing execution; cloud/cross-device fallback is strictly prohibited.`,
          })
        }

        const body = await readBody()
        const { workspace, prompt, action, command, folder, dir, file, content, timeoutMs } = body

        // Dispatch execution frame through tunnel to local host
        try {
          const response = await this._dispatchToDevice(targetDeviceId, user.id, {
            method: 'POST',
            path: '/local/execute',
            headers: { 'Content-Type': 'application/json' },
            body: {
              workspace,
              prompt,
              action,
              command,
              folder,
              dir,
              file,
              content,
              timeoutMs,
              requestedBy: user.id,
            },
          })
          return sendJson(response.status || 200, response.body || {})
        } catch (err) {
          const status = err.status || 500
          return sendJson(status, {
            error: err.code || 'DISPATCH_ERROR',
            message: err.message,
          })
        }
      }

      // User API: Execute terminal command directly on local device
      // POST /api/devices/:deviceId/terminal
      const termMatch = path.match(/^\/api\/devices\/([^/]+)\/terminal$/)
      if (termMatch && method === 'POST') {
        if (!user) return sendJson(401, { error: 'UNAUTHORIZED', message: 'Authentication required' })
        const targetDeviceId = decodeURIComponent(termMatch[1])
        const deviceCheck = this.registry.getDeviceForUser(targetDeviceId, user.id)
        if (!deviceCheck.ok) {
          return sendJson(deviceCheck.status, { error: 'CROSS_USER_ACCESS_DENIED', message: deviceCheck.error })
        }
        if (deviceCheck.device.status !== 'online') {
          return sendJson(503, { error: 'DEVICE_OFFLINE', message: `Device [${targetDeviceId}] is currently offline.` })
        }
        const body = await readBody()
        try {
          const response = await this._dispatchToDevice(targetDeviceId, user.id, {
            method: 'POST',
            path: '/local/execute',
            headers: { 'Content-Type': 'application/json' },
            body: {
              action: 'terminal',
              command: body.command,
              workspace: body.workspace,
              timeoutMs: body.timeoutMs,
              requestedBy: user.id,
            },
          })
          return sendJson(response.status || 200, response.body || {})
        } catch (err) {
          return sendJson(err.status || 500, { error: err.code || 'TERMINAL_ERROR', message: err.message })
        }
      }

      // User API: Create folder / workflow folder directly on local device
      // POST /api/devices/:deviceId/fs/mkdir
      const mkdirMatch = path.match(/^\/api\/devices\/([^/]+)\/fs\/mkdir$/)
      if (mkdirMatch && method === 'POST') {
        if (!user) return sendJson(401, { error: 'UNAUTHORIZED', message: 'Authentication required' })
        const targetDeviceId = decodeURIComponent(mkdirMatch[1])
        const deviceCheck = this.registry.getDeviceForUser(targetDeviceId, user.id)
        if (!deviceCheck.ok) {
          return sendJson(deviceCheck.status, { error: 'CROSS_USER_ACCESS_DENIED', message: deviceCheck.error })
        }
        if (deviceCheck.device.status !== 'online') {
          return sendJson(503, { error: 'DEVICE_OFFLINE', message: `Device [${targetDeviceId}] is currently offline.` })
        }
        const body = await readBody()
        try {
          const response = await this._dispatchToDevice(targetDeviceId, user.id, {
            method: 'POST',
            path: '/local/execute',
            headers: { 'Content-Type': 'application/json' },
            body: {
              action: 'create_folder',
              folder: body.folder || body.dir || body.path,
              workspace: body.workspace,
              requestedBy: user.id,
            },
          })
          return sendJson(response.status || 200, response.body || {})
        } catch (err) {
          return sendJson(err.status || 500, { error: err.code || 'FS_ERROR', message: err.message })
        }
      }

      // User API: Proxy general requests through tunnel to Local Host Harness runtime
      // ALL /devices/:deviceId/*
      const deviceProxyMatch = path.match(/^\/devices\/([^/]+)(\/.*)$/)
      if (deviceProxyMatch) {
        if (!user) return sendJson(401, { error: 'UNAUTHORIZED', message: 'Authentication required' })
        const targetDeviceId = decodeURIComponent(deviceProxyMatch[1])
        const subPath = deviceProxyMatch[2]

        // Ownership check
        const deviceCheck = this.registry.getDeviceForUser(targetDeviceId, user.id)
        if (!deviceCheck.ok) {
          return sendJson(deviceCheck.status, {
            error: 'CROSS_USER_ACCESS_DENIED',
            message: deviceCheck.error,
          })
        }

        if (deviceCheck.device.status !== 'online') {
          return sendJson(503, {
            error: 'DEVICE_OFFLINE',
            message: `Device [${targetDeviceId}] is offline. No fallback permitted.`,
          })
        }

        const body = (method === 'POST' || method === 'PUT') ? await readBody() : null
        try {
          const response = await this._dispatchToDevice(targetDeviceId, user.id, {
            method,
            path: subPath,
            headers: req.headers,
            body,
          })
          return sendJson(response.status || 200, response.body || {})
        } catch (err) {
          return sendJson(err.status || 500, { error: err.code || 'PROXY_ERROR', message: err.message })
        }
      }

      // Fallback: Only the admin account may use the shared DeepSeek Harness instance.
      if (user && (user.id === 'pat' || user.role === 'admin')) {
        return proxyToHarness(req, res, { targetPort: this.harnessPort, user, injectNav: false })
      }

      // If unauthenticated API call, return 401
      if (path.startsWith('/api/')) {
        return sendJson(401, { error: 'UNAUTHORIZED', message: 'Authentication required' })
      }

      // Fallback 404
      return sendJson(404, { error: 'NOT_FOUND', path })
    } catch (err) {
      return sendJson(err.status || 500, { error: err.code || 'INTERNAL_ERROR', message: err.message })
    }
  }
}
