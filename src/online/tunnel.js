import { EventEmitter } from 'node:events'
import { randomBytes } from 'node:crypto'

/**
 * TunnelManager handles outbound reverse tunnel connections from Local Patze Hosts
 * to Patze Online control plane.
 *
 * Architecture:
 * - Local Host establishes an outbound long-lived streaming connection to Patze Online.
 * - Patze Online can dispatch requests down to Local Host and await matching responses.
 * - Heartbeats keep the tunnel active and prove real-time device presence.
 * - Zero inbound port forwarding needed on user's machine.
 */
export class TunnelManager extends EventEmitter {
  /**
   * @param {import('./registry.js').DeviceRegistry} registry
   */
  constructor(registry) {
    super()
    this.registry = registry

    /** @type {Map<string, {
     *   deviceId: string,
     *   userId: string,
     *   res: import('node:http').ServerResponse,
     *   req: import('node:http').IncomingMessage,
     *   pendingRequests: Map<string, { resolve: Function, reject: Function, timer: any }>,
     *   connectedAt: number
     * }>} */
    this.tunnels = new Map()
  }

  /**
   * Handle an inbound tunnel connection from a Local Host
   * @param {object} params
   * @param {string} params.deviceId
   * @param {string} params.userId
   * @param {import('node:http').IncomingMessage} params.req
   * @param {import('node:http').ServerResponse} params.res
   * @param {object} [params.metadata]
   */
  acceptTunnel({ deviceId, userId, req, res, metadata = {} }) {
    // If there's an existing tunnel for this device, gracefully close the old one
    const existing = this.tunnels.get(deviceId)
    if (existing) {
      try {
        existing.res.end()
      } catch {}
      this.tunnels.delete(deviceId)
    }

    // Prepare streaming HTTP response
    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Patze-Tunnel': '1.0',
    })

    const tunnelEntry = {
      deviceId,
      userId,
      res,
      req,
      pendingRequests: new Map(),
      connectedAt: Date.now(),
    }

    this.tunnels.set(deviceId, tunnelEntry)
    this.registry.connectDevice(deviceId, userId, this, metadata)

    // Send initial handshake frame
    this._writeFrame(res, {
      type: 'handshake',
      deviceId,
      userId,
      serverTime: Date.now(),
    })

    // Handle tunnel disconnection
    const cleanup = (reason) => {
      if (this.tunnels.get(deviceId) === tunnelEntry) {
        this.tunnels.delete(deviceId)
        this.registry.disconnectDevice(deviceId, reason)
        // Reject any pending requests
        for (const [reqId, pending] of tunnelEntry.pendingRequests.entries()) {
          clearTimeout(pending.timer)
          pending.reject(new Error(`Tunnel closed: ${reason}`))
        }
        tunnelEntry.pendingRequests.clear()
      }
    }

    req.on('aborted', () => cleanup('client_aborted'))
    res.on('close', () => cleanup('client_closed'))
    req.on('error', (err) => cleanup(`error: ${err.message}`))
    res.on('error', (err) => cleanup(`res_error: ${err.message}`))

    return tunnelEntry
  }

  /**
   * Handle an uplink response frame posted from Local Host
   * @param {string} deviceId
   * @param {string} userId
   * @param {object} frame
   */
  handleUplinkFrame(deviceId, userId, frame) {
    const tunnel = this.tunnels.get(deviceId)
    if (!tunnel) {
      return { ok: false, error: 'Tunnel not found or device offline' }
    }
    if (tunnel.userId !== userId) {
      return { ok: false, error: 'Forbidden: Device ownership mismatch' }
    }

    // Touch heartbeat
    this.registry.touchHeartbeat(deviceId, userId)

    if (frame.type === 'response' && frame.id) {
      const pending = tunnel.pendingRequests.get(frame.id)
      if (pending) {
        clearTimeout(pending.timer)
        tunnel.pendingRequests.delete(frame.id)
        pending.resolve(frame)
        return { ok: true }
      }
    }

    if (frame.type === 'heartbeat') {
      return { ok: true, ack: true }
    }

    return { ok: true }
  }

  /**
   * Forward a request from Patze Online down to the Local Host
   * @param {string} deviceId
   * @param {object} reqPayload
   * @param {string} reqPayload.method
   * @param {string} reqPayload.path
   * @param {Record<string, string>} [reqPayload.headers]
   * @param {any} [reqPayload.body]
   * @param {number} [timeoutMs]
   * @returns {Promise<{ status: number, headers: Record<string, string>, body: any }>}
   */
  async dispatchToDevice(deviceId, reqPayload, timeoutMs = 30000) {
    const tunnel = this.tunnels.get(deviceId)
    if (!tunnel) {
      const err = new Error(`Device ${deviceId} is offline`)
      err.code = 'DEVICE_OFFLINE'
      err.status = 503
      throw err
    }

    const id = `req_${Date.now()}_${randomBytes(6).toString('hex')}`
    const frame = {
      type: 'request',
      id,
      method: reqPayload.method || 'GET',
      path: reqPayload.path || '/',
      headers: reqPayload.headers || {},
      body: reqPayload.body || null,
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        tunnel.pendingRequests.delete(id)
        const timeoutErr = new Error(`Device ${deviceId} request timed out after ${timeoutMs}ms`)
        timeoutErr.code = 'DEVICE_TIMEOUT'
        timeoutErr.status = 504
        reject(timeoutErr)
      }, timeoutMs)

      tunnel.pendingRequests.set(id, { resolve, reject, timer })

      try {
        this._writeFrame(tunnel.res, frame)
      } catch (err) {
        clearTimeout(timer)
        tunnel.pendingRequests.delete(id)
        reject(err)
      }
    })
  }

  /**
   * Write NDJSON frame to response stream
   * @private
   */
  _writeFrame(res, frame) {
    const line = JSON.stringify(frame) + '\n'
    res.write(line)
  }
}
