import { resolve, dirname } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

/**
 * Local Host Device Pairing & Identity Persistence
 */

export function getDefaultConfigPath(baseDir = homedir()) {
  return resolve(baseDir, '.patze/device.json')
}

export function loadDeviceConfig(configPath = getDefaultConfigPath()) {
  if (!existsSync(configPath)) return null
  try {
    const raw = readFileSync(configPath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveDeviceConfig(config, configPath = getDefaultConfigPath()) {
  const dir = dirname(configPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 })
  if (process.platform !== 'win32') chmodSync(configPath, 0o600)
  return config
}

export function assertSecureOnlineUrl(onlineUrl) {
  const url = new URL(onlineUrl)
  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHosts.has(url.hostname))) {
    throw new Error('Patze Host requires HTTPS when connecting to a non-local Online server')
  }
  return url
}

/**
 * Pair local host with Patze Online control plane
 * @param {object} params
 * @param {string} params.onlineUrl
 * @param {string} params.userId
 * @param {string} params.secret
 * @param {string} [params.deviceId]
 * @param {string} [params.deviceName]
 * @param {string[]} [params.allowedWorkspaces]
 * @param {string} [params.configPath]
 */
export async function pairLocalHost({
  onlineUrl,
  userId,
  secret,
  deviceId,
  deviceName,
  allowedWorkspaces = [],
  configPath = getDefaultConfigPath(),
}) {
  assertSecureOnlineUrl(onlineUrl)
  const finalDeviceId = deviceId || `dev_${userId}_${randomBytes(4).toString('hex')}`
  const finalDeviceName = deviceName || `${userId.toUpperCase()} PC`

  const payload = {
    userId,
    deviceId: finalDeviceId,
    deviceName: finalDeviceName,
    secret,
    platform: process.platform,
    arch: process.arch,
    hostVersion: '0.1.0',
    allowedWorkspaces,
  }

  const endpoint = new URL('/api/devices/pair', onlineUrl).toString()
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(`Pairing failed (${res.status}): ${data.message || data.error || JSON.stringify(data)}`)
  }

  const saved = saveDeviceConfig({
    ...payload,
    onlineUrl,
    pairedAt: Date.now(),
  }, configPath)

  return saved
}
