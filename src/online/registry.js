import { EventEmitter } from 'node:events'

/**
 * Device Registry & Presence Manager for Patze Online (Alpha)
 *
 * Enforces:
 * 1. Strict server-side device ownership (user A cannot see or access user B's device).
 * 2. True presence detection (no fabricated online status; disconnects/timeouts immediately set status = 'offline').
 * 3. No cross-device or cloud fallback.
 */

export const DEVICE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
}

export class DeviceRegistry extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {number} [options.heartbeatTimeoutMs]
   */
  constructor(options = {}) {
    super()
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs || 10000

    /** @type {Map<string, {
     *   deviceId: string,
     *   userId: string,
     *   deviceName: string,
     *   platform: string,
     *   arch: string,
     *   hostVersion: string,
     *   allowedWorkspaces: string[],
     *   status: string,
     *   lastSeen: number,
     *   tunnel: any | null,
     *   metadata: Record<string, unknown>
     * }>} */
    this.devices = new Map()

    this._reapInterval = setInterval(() => {
      this.reapStaleDevices()
    }, Math.min(2000, Math.floor(this.heartbeatTimeoutMs / 2)))

    if (this._reapInterval.unref) {
      this._reapInterval.unref()
    }
  }

  dispose() {
    if (this._reapInterval) {
      clearInterval(this._reapInterval)
      this._reapInterval = null
    }
    this.devices.clear()
  }

  /**
   * Register or pair a device
   * @param {object} params
   * @param {string} params.deviceId
   * @param {string} params.userId
   * @param {string} params.deviceName
   * @param {string} [params.platform]
   * @param {string} [params.arch]
   * @param {string} [params.hostVersion]
   * @param {string[]} [params.allowedWorkspaces]
   */
  registerDevice({
    deviceId,
    userId,
    deviceName,
    platform = process.platform,
    arch = process.arch,
    hostVersion = '0.1.0',
    allowedWorkspaces = [],
  }) {
    if (!deviceId || typeof deviceId !== 'string') {
      throw new Error('Invalid deviceId')
    }
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId')
    }

    const existing = this.devices.get(deviceId)
    if (existing && existing.userId !== userId) {
      throw new Error('Device ID already bound to another user account')
    }

    const record = {
      deviceId,
      userId,
      deviceName: deviceName || deviceId,
      platform,
      arch,
      hostVersion,
      allowedWorkspaces: Array.isArray(allowedWorkspaces) ? allowedWorkspaces : [],
      status: DEVICE_STATUS.OFFLINE,
      lastSeen: 0,
      tunnel: null,
      metadata: {},
    }

    this.devices.set(deviceId, record)
    this.emit('device:registered', record)
    return record
  }

  /**
   * Bind an active online tunnel to a device
   * @param {string} deviceId
   * @param {string} userId
   * @param {any} tunnel
   * @param {object} [metadata]
   */
  connectDevice(deviceId, userId, tunnel, metadata = {}) {
    const device = this.devices.get(deviceId)
    if (!device) {
      throw new Error(`Device ${deviceId} not registered`)
    }
    if (device.userId !== userId) {
      throw new Error(`Forbidden: Device ${deviceId} does not belong to user ${userId}`)
    }

    device.status = DEVICE_STATUS.ONLINE
    device.lastSeen = Date.now()
    device.tunnel = tunnel
    if (metadata && typeof metadata === 'object') {
      device.metadata = { ...device.metadata, ...metadata }
      if (Array.isArray(metadata.allowedWorkspaces)) {
        device.allowedWorkspaces = metadata.allowedWorkspaces
      }
    }

    this.emit('device:connected', device)
    return device
  }

  /**
   * Mark a device as offline
   * @param {string} deviceId
   * @param {string} [reason]
   */
  disconnectDevice(deviceId, reason = 'client_disconnected') {
    const device = this.devices.get(deviceId)
    if (!device) return

    device.status = DEVICE_STATUS.OFFLINE
    device.tunnel = null
    this.emit('device:disconnected', { device, reason })
  }

  /**
   * Update heartbeat timestamp
   * @param {string} deviceId
   * @param {string} userId
   */
  touchHeartbeat(deviceId, userId) {
    const device = this.devices.get(deviceId)
    if (!device) return false
    if (device.userId !== userId) return false

    device.lastSeen = Date.now()
    if (device.status === DEVICE_STATUS.OFFLINE) {
      device.status = DEVICE_STATUS.ONLINE
    }
    return true
  }

  /**
   * List devices owned by a user
   * @param {string} userId
   */
  listDevicesForUser(userId) {
    const results = []
    for (const d of this.devices.values()) {
      if (d.userId === userId) {
        results.push({
          deviceId: d.deviceId,
          userId: d.userId,
          deviceName: d.deviceName,
          platform: d.platform,
          arch: d.arch,
          hostVersion: d.hostVersion,
          status: d.status,
          lastSeen: d.lastSeen,
          allowedWorkspaces: d.allowedWorkspaces,
        })
      }
    }
    return results
  }

  /**
   * Get device with strict ownership enforcement
   * @param {string} deviceId
   * @param {string} userId
   * @returns {{ ok: true, device: any } | { ok: false, status: number, error: string }}
   */
  getDeviceForUser(deviceId, userId) {
    const device = this.devices.get(deviceId)
    if (!device) {
      return { ok: false, status: 404, error: 'Device not found' }
    }
    if (device.userId !== userId) {
      return { ok: false, status: 403, error: `Forbidden: Device ${deviceId} does not belong to user ${userId}` }
    }
    return { ok: true, device }
  }

  /**
   * Check and transition stale devices to offline
   */
  reapStaleDevices() {
    const now = Date.now()
    for (const device of this.devices.values()) {
      if (device.status === DEVICE_STATUS.ONLINE && (now - device.lastSeen > this.heartbeatTimeoutMs)) {
        device.status = DEVICE_STATUS.OFFLINE
        device.tunnel = null
        this.emit('device:stale', device)
      }
    }
  }
}
