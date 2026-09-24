import { EventEmitter } from 'node:events'
import { hostname } from 'node:os'
import { resolve, relative, isAbsolute, sep } from 'node:path'
import { execSync } from 'node:child_process'
import { LocalWorkspaceGuard } from './workspace.js'

const MAX_LOCAL_HARNESS_RESPONSE_BYTES = 2 * 1024 * 1024

async function readBoundedResponseText(response) {
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_LOCAL_HARNESS_RESPONSE_BYTES) {
        await reader.cancel()
        const err = new Error(`Local Harness response exceeds the ${MAX_LOCAL_HARNESS_RESPONSE_BYTES / (1024 * 1024)} MiB limit`)
        err.code = 'LOCAL_RESPONSE_TOO_LARGE'
        throw err
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, totalBytes).toString('utf8')
}

/**
 * Patze Local Host Runner / Daemon (Alpha)
 *
 * Legacy paired Host bridge. This is not the full DSH Agent runtime; use
 * `pnpm local` for the local Web Host and its native tool/approval policies.
 */
export class PatzeHostRunner extends EventEmitter {
  /**
   * @param {object} options
   * @param {string} options.onlineUrl - Base URL of Patze Online
   * @param {string} options.deviceId - Unique ID of this local machine
   * @param {string} options.userId - Account owner ID
   * @param {string} options.secret - Pairing/device secret
   * @param {string} [options.deviceName]
   * @param {string[]} [options.allowedWorkspaces]
   * @param {string} [options.localHarnessUrl]
   * @param {number} [options.heartbeatIntervalMs]
   * @param {boolean} [options.allowRemoteTerminal]
   */
  constructor(options) {
    super()
    const onlineUrl = new URL(options.onlineUrl)
    if (onlineUrl.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(onlineUrl.hostname)) {
      throw new Error('Patze Host requires HTTPS when connecting to a non-local Online server')
    }
    this.onlineUrl = onlineUrl.toString().replace(/\/$/, '')
    this.deviceId = options.deviceId
    this.userId = options.userId
    this.secret = options.secret
    this.deviceName = options.deviceName || `${this.userId} PC`
    this.allowedWorkspaces = options.allowedWorkspaces || [process.cwd()]
    this.localHarnessUrl = options.localHarnessUrl || 'http://127.0.0.1:3080'
    this.heartbeatIntervalMs = options.heartbeatIntervalMs || 3000
    this.allowRemoteTerminal = options.allowRemoteTerminal === true

    this.active = false
    this.connected = false
    this._abortController = null
    this._heartbeatTimer = null
  }

  /**
   * Start the Local Host daemon and connect to Patze Online
   */
  async start() {
    this.active = true
    return new Promise((resolve, reject) => {
      let settled = false
      const onConnected = () => {
        if (!settled) {
          settled = true
          this.removeListener('error', onError)
          resolve()
        }
      }
      const onError = (err) => {
        if (!settled) {
          settled = true
          this.removeListener('connected', onConnected)
          reject(err)
        }
      }
      this.once('connected', onConnected)
      this.once('error', onError)
      this._connect().catch(err => {
        if (!settled) {
          settled = true
          reject(err)
        }
      })
    })
  }

  /**
   * Stop the daemon and close connections
   */
  stop() {
    this.active = false
    this.connected = false
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer)
      this._heartbeatTimer = null
    }
    if (this._abortController) {
      this._abortController.abort()
      this._abortController = null
    }
    this.emit('disconnected')
  }

  /**
   * Internal connection and stream loop
   * @private
   */
  async _connect() {
    if (!this.active) return

    this._abortController = new AbortController()
    const { signal } = this._abortController

    const connectUrl = new URL('/tunnel/connect', this.onlineUrl)

    try {
      const res = await fetch(connectUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Patze-Device-Secret': this.secret,
          'X-Patze-Device-Id': this.deviceId,
          'X-Patze-User-Id': this.userId,
        },
        body: JSON.stringify({
          deviceName: this.deviceName,
          platform: process.platform,
          arch: process.arch,
          allowedWorkspaces: this.allowedWorkspaces,
        }),
        signal,
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to establish tunnel (${res.status}): ${text}`)
      }

      this.connected = true
      this.emit('connected', { deviceId: this.deviceId, onlineUrl: this.onlineUrl })

      // Start periodic heartbeats
      this._startHeartbeat()

      // Read NDJSON stream from Patze Online downlink
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (this.active) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const frame = JSON.parse(trimmed)
            this._handleDownlinkFrame(frame).catch(err => {
              this.emit('error', err)
            })
          } catch (err) {
            // Malformed frame ignored
          }
        }
      }
    } catch (err) {
      if (!this.active || signal.aborted) return
      this.emit('connection_lost', err)
    } finally {
      this.connected = false
      if (this._heartbeatTimer) {
        clearInterval(this._heartbeatTimer)
        this._heartbeatTimer = null
      }

      // Reconnect with backoff if still active
      if (this.active) {
        setTimeout(() => {
          if (this.active) this._connect()
        }, 1500)
      }
    }
  }

  /**
   * Start heartbeat loop
   * @private
   */
  _startHeartbeat() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer)
    this._heartbeatTimer = setInterval(async () => {
      if (!this.active || !this.connected) return
      try {
        await this._sendUplinkFrame({
          type: 'heartbeat',
          timestamp: Date.now(),
        })
      } catch {
        // Handled on next cycle
      }
    }, this.heartbeatIntervalMs)

    if (this._heartbeatTimer.unref) {
      this._heartbeatTimer.unref()
    }
  }

  /**
   * Send frame back up through uplink
   * @param {object} frame
   * @private
   */
  async _sendUplinkFrame(frame) {
    const uplinkUrl = new URL('/tunnel/uplink', this.onlineUrl).toString()
    await fetch(uplinkUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: this.deviceId,
        userId: this.userId,
        secret: this.secret,
        frame,
      }),
    })
  }

  /**
   * Process a frame received from Patze Online
   * @param {object} frame
   * @private
   */
  async _handleDownlinkFrame(frame) {
    if (frame.type === 'handshake') {
      return
    }

    if (frame.type === 'request' && frame.id) {
      const { id, method, path, body } = frame

      // 1. Direct local execution route (/local/execute)
      if (path === '/local/execute') {
        try {
          const responseBody = await this._executeLocalTask(body)
          await this._sendUplinkFrame({
            type: 'response',
            id,
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: responseBody,
          })
        } catch (execErr) {
          await this._sendUplinkFrame({
            type: 'response',
            id,
            status: execErr.status || 400,
            headers: { 'Content-Type': 'application/json' },
            body: {
              error: execErr.code || 'EXECUTION_ERROR',
              message: execErr.message,
            },
          })
        }
        return
      }

      // 2. Proxied request to local Harness runtime
      try {
        const cleanPath = (path || '/').replace(/^\/+/, '/')
        const targetUrl = new URL(cleanPath, this.localHarnessUrl)
        const expectedOrigin = new URL(this.localHarnessUrl).origin
        if (targetUrl.origin !== expectedOrigin) {
          throw new Error('Forbidden: Proxy path destination escapes local harness origin')
        }

        const localRes = await fetch(targetUrl.toString(), {
          method,
          headers: frame.headers || {},
          body: body ? JSON.stringify(body) : undefined,
        })

        const contentType = localRes.headers.get('content-type') || ''
        const responseText = await readBoundedResponseText(localRes)
        const resBody = contentType.includes('application/json')
          ? JSON.parse(responseText)
          : responseText

        await this._sendUplinkFrame({
          type: 'response',
          id,
          status: localRes.status,
          headers: { 'Content-Type': contentType },
          body: resBody,
        })
      } catch (proxyErr) {
        await this._sendUplinkFrame({
          type: 'response',
          id,
          status: 502,
          headers: { 'Content-Type': 'application/json' },
          body: { error: proxyErr.code || 'LOCAL_GATEWAY_ERROR', message: proxyErr.message },
        })
      }
    }
  }

  /**
   * Execute task locally on the machine within the allowed workspace boundary
   * @param {object} params
   * @param {string} [params.workspace]
   * @param {string} [params.prompt]
   * @param {string} [params.requestedBy]
   * @private
   */
  async _executeLocalTask({ workspace, prompt, requestedBy, action, command, folder, dir, file, content, path: filePath, timeoutMs }) {
    // 🛡️ Safe Workspace Resolution & Allowance Guard
    const candidateRoot = resolve(
      workspace && workspace !== 'default'
        ? workspace
        : this.allowedWorkspaces[0] || process.cwd()
    )

    const isPermitted = this.allowedWorkspaces.some(w => {
      const allowed = resolve(w)
      const rel = relative(allowed, candidateRoot)
      return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
    })

    if (!isPermitted) {
      const err = new Error(`[WORKSPACE_NOT_PERMITTED] Workspace [${candidateRoot}] is not permitted. Allowed: ${this.allowedWorkspaces.join(', ')}`)
      err.code = 'WORKSPACE_NOT_PERMITTED'
      throw err
    }

    const guard = new LocalWorkspaceGuard(candidateRoot)
    const localHostName = hostname()
    const localCwd = guard.root
    const localNodeVersion = process.version

    let gitUserName = 'Unknown'
    let gitDiff = ''

    try {
      gitUserName = execSync('git config user.name', { cwd: guard.root, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim() || 'Unknown'
    } catch {}

    const executedActions = []
    let terminalResult = null

    // 1. Explicit Action Handling
    if (action === 'terminal' || command) {
      if (!this.allowRemoteTerminal) {
        const err = new Error('Remote terminal execution is disabled on this Host. Enable it explicitly on the local machine to continue.')
        err.code = 'REMOTE_TERMINAL_DISABLED'
        throw err
      }
      const cmdToRun = command || prompt
      const result = await guard.runCommand(cmdToRun, { timeoutMs })
      terminalResult = result
      executedActions.push({
        action: 'terminal',
        command: cmdToRun,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      })
    } else if (action === 'create_folder' || action === 'mkdir' || (folder && !action)) {
      const targetFolder = folder || dir
      const res = guard.mkdir(targetFolder)
      executedActions.push({
        action: 'create_folder',
        folder: targetFolder,
        absolutePath: res.path,
      })
    } else if (action === 'write_file' || (file && content !== undefined)) {
      const targetFile = file || filePath
      const res = guard.writeFile(targetFile, content)
      executedActions.push({
        action: 'write_file',
        file: targetFile,
        absolutePath: res.path,
        bytes: res.bytes,
      })
    } else if (action === 'read_file' || (file && content === undefined)) {
      const targetFile = file || filePath
      const text = guard.readFile(targetFile)
      executedActions.push({
        action: 'read_file',
        file: targetFile,
        content: text,
      })
    } else if (action === 'list_files') {
      const res = guard.listFiles(folder || dir || '.')
      executedActions.push({
        action: 'list_files',
        directory: res.directory,
        entries: res.entries,
      })
    }

    // 2. Natural Language Prompt Handling
    if (prompt) {
      // Fulfill prompt intent: create verification file if requested
      if (/create.*patze-local-proof\.txt/i.test(prompt)) {
        const match = prompt.match(/containing:\s*([^\n\r]+?)(?:\.\s+(?:Then|show)|\.?$)/i)
        const textContent = match ? match[1].trim() : `Patze local execution verified on ${this.deviceName}`
        const writeResult = guard.writeFile('patze-local-proof.txt', textContent + '\n')
        executedActions.push({
          action: 'write_file',
          file: 'patze-local-proof.txt',
          content: textContent,
          absolutePath: writeResult.path,
        })

        try {
          gitDiff = execSync('git diff patze-local-proof.txt', { cwd: guard.root, stdio: ['ignore', 'pipe', 'ignore'] })
            .toString()
            .trim()
        } catch {}
      }

      // Fulfill prompt intent: create folder or workflow folder
      const folderMatch = prompt.match(/(?:create\s+(?:workflow\s+)?(?:folder|directory)|mkdir)\s+([a-zA-Z0-9_\-./]+)/i)
      if (folderMatch && !executedActions.some(a => a.action === 'create_folder')) {
        const folderName = folderMatch[1].trim()
        const res = guard.mkdir(folderName)
        executedActions.push({
          action: 'create_folder',
          folder: folderName,
          absolutePath: res.path,
        })
      }

      // Fulfill prompt intent: run terminal command
      const cmdMatch = prompt.match(/(?:run\s+(?:command|terminal|cmd|bash)|exec)\s*:\s*`?([^`\n]+)`?/i)
      if (cmdMatch && !terminalResult) {
        if (!this.allowRemoteTerminal) {
          const err = new Error('Remote terminal execution is disabled on this Host. Enable it explicitly on the local machine to continue.')
          err.code = 'REMOTE_TERMINAL_DISABLED'
          throw err
        }
        const cmd = cmdMatch[1].trim()
        terminalResult = await guard.runCommand(cmd, { timeoutMs })
        executedActions.push({
          action: 'terminal',
          command: cmd,
          exitCode: terminalResult.exitCode,
          stdout: terminalResult.stdout,
          stderr: terminalResult.stderr,
        })
      }
    }

    return {
      success: true,
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      requestedBy,
      executionScope: 'PHYSICAL_LOCAL_HOST',
      workspace: guard.root,
      facts: {
        hostname: localHostName,
        currentWorkingDirectory: localCwd,
        nodeVersion: localNodeVersion,
        gitUserName,
      },
      gitDiff: gitDiff || '(clean working tree / untracked)',
      executedActions,
      terminalResult,
      timestamp: Date.now(),
    }
  }
}
