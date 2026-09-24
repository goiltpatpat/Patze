import assert from 'node:assert/strict'
import test from 'node:test'
import { MonitorTracker, renderMonitorHtml } from './monitor.js'

test('records dispatch outcomes without persisting prompts, paths, or error text', () => {
  const tracker = new MonitorTracker()
  const lastSeen = Date.now() - 10
  const registry = {
    devices: new Map([['device-1', {
      deviceId: 'device-1',
      userId: 'pat',
      deviceName: 'Pat MacBook',
      status: 'online',
      lastSeen,
      allowedWorkspaces: [],
    }]]),
  }
  tracker.recordTask({
    userId: 'pat',
    deviceId: 'device-1',
    prompt: 'private prompt',
    workspace: '/private/project',
    error: 'private provider error',
    status: 'FAILED',
    durationMs: 12,
  })

  const snapshot = tracker.getSnapshot(registry, { sessions: new Map() })
  const serialized = JSON.stringify(snapshot)

  assert.equal(snapshot.stats.totalDispatches, 1)
  assert.equal(snapshot.stats.failedDispatches, 1)
  assert.equal(snapshot.devices[0].lastSeen, lastSeen)
  assert.ok(snapshot.devices[0].latencyMs >= 0)
  assert.equal(snapshot.events[0].action, 'Local task failed')
  assert.deepEqual(snapshot.events[0].details, { durationMs: 12 })
  assert.equal(serialized.includes('private prompt'), false)
  assert.equal(serialized.includes('/private/project'), false)
  assert.equal(serialized.includes('private provider error'), false)
})

test('escapes untrusted monitor metadata in initial and refreshed event markup', () => {
  const payload = '<img src=x onerror=alert(1)>'
  const snapshot = {
    server: {},
    stats: {
      onlineDeviceCount: 1,
      totalDeviceCount: 1,
      activeSessionCount: 1,
      totalDispatches: 1,
      successRate: '100%',
    },
    devices: [{
      deviceName: payload,
      deviceId: payload,
      userId: payload,
      status: 'online',
      latencyMs: 1,
      platform: payload,
      arch: payload,
    }],
    sessions: [{
      userId: payload,
      tokenPreview: payload,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    }],
    events: [{
      type: payload,
      userId: payload,
      deviceId: payload,
      action: payload,
      status: 'FAILED',
      details: { payload },
      timestamp: Date.now(),
    }],
    jev: { intentLatency: '1 ms', toolReduction: '0%' },
  }

  const html = renderMonitorHtml(snapshot, { name: payload, id: 'admin' })

  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'))
  assert.equal(html.includes(payload), false)
  assert.ok(html.includes('escapeHtml(e.type)'))
  assert.ok(html.includes('escapeHtml(e.userId)'))
  assert.ok(html.includes('escapeHtml(e.action)'))
  assert.ok(html.includes('escapeHtml(JSON.stringify(e.details))'))
})
