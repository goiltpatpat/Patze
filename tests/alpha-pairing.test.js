import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, readFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PatzeOnlineServer } from '../src/online/server.js'
import { AuthService } from '../src/online/auth.js'
import { PatzeHostRunner } from '../src/host/runner.js'
import { LocalWorkspaceGuard } from '../src/host/workspace.js'

const TEST_AUTH_USERS = {
  pat: {
    id: 'pat', name: 'Pat', email: 'pat@example.test',
    password: 'test-only-pat-password-long-enough', pairingSecret: 'test-only-pat-pairing-secret-more-than-32-chars',
  },
  peat: {
    id: 'peat', name: 'Peat', email: 'peat@example.test',
    password: 'test-only-peat-password-long-enough', pairingSecret: 'test-only-peat-pairing-secret-more-than-32-chars',
  },
  brother: {
    id: 'brother', name: 'Brother', email: 'brother@example.test',
    password: 'test-only-brother-password-long-enough', pairingSecret: 'test-only-brother-pairing-secret-more-than-32-chars',
  },
}

describe('Patze Local Host + Online Device Pairing Alpha — End-to-End Verification', () => {
  let onlineServer
  let onlineUrl
  let tempBaseDir
  let patWorkspace
  let brotherWorkspace

  let patHost
  let brotherHost

  const PAT_DEVICE_ID = 'dev_pat_pc_alpha'
  const BROTHER_DEVICE_ID = 'dev_brother_pc_alpha'

  test('Patze Online refuses direct non-loopback HTTP binding', () => {
    for (const host of ['0.0.0.0', 'localhost']) {
      assert.throws(
        () => new PatzeOnlineServer({ host, authUsers: TEST_AUTH_USERS }),
        /binds to loopback only/,
      )
    }
  })

  before(async () => {
    // 1. Create isolated temporary local workspaces for Pat and Brother
    tempBaseDir = mkdtempSync(join(tmpdir(), 'patze-alpha-'))
    patWorkspace = join(tempBaseDir, 'pat-workspace')
    brotherWorkspace = join(tempBaseDir, 'brother-workspace')

    // 2. Start Patze Online Control Plane on an ephemeral port
    onlineServer = new PatzeOnlineServer({ port: 0, heartbeatTimeoutMs: 3000, authUsers: TEST_AUTH_USERS })
    const info = await onlineServer.listen()
    onlineUrl = info.url

    onlineServer.auth.createSession('pat', 'pat-session-token')
    onlineServer.auth.createSession('peat', 'peat-session-token')
    onlineServer.auth.createSession('brother', 'brother-session-token')

    // 3. Pair & Start Pat's Local Host
    onlineServer.registry.registerDevice({
      deviceId: PAT_DEVICE_ID,
      userId: 'pat',
      deviceName: 'Pat PC',
      allowedWorkspaces: [patWorkspace],
    })

    patHost = new PatzeHostRunner({
      onlineUrl,
      deviceId: PAT_DEVICE_ID,
      userId: 'pat',
      secret: TEST_AUTH_USERS.pat.pairingSecret,
      deviceName: 'Pat PC',
      allowedWorkspaces: [patWorkspace],
      allowRemoteTerminal: true,
      heartbeatIntervalMs: 500,
    })
    await patHost.start()

    // 4. Pair & Start Brother's Local Host
    onlineServer.registry.registerDevice({
      deviceId: BROTHER_DEVICE_ID,
      userId: 'brother',
      deviceName: 'Brother PC',
      allowedWorkspaces: [brotherWorkspace],
    })

    brotherHost = new PatzeHostRunner({
      onlineUrl,
      deviceId: BROTHER_DEVICE_ID,
      userId: 'brother',
      secret: TEST_AUTH_USERS.brother.pairingSecret,
      deviceName: 'Brother PC',
      allowedWorkspaces: [brotherWorkspace],
      allowRemoteTerminal: true,
      heartbeatIntervalMs: 500,
    })
    await brotherHost.start()

    // Wait 300ms for tunnels to settle
    await new Promise(r => setTimeout(r, 300))
  })

  after(async () => {
    if (patHost) patHost.stop()
    if (brotherHost) brotherHost.stop()
    if (onlineServer) await onlineServer.close()
    if (tempBaseDir && existsSync(tempBaseDir)) {
      try {
        rmSync(tempBaseDir, { recursive: true, force: true })
      } catch {}
    }
  })

  test('Online auth has no built-in credentials or seeded sessions', () => {
    const auth = new AuthService({})
    assert.equal(auth.hasConfiguredCredentials(), false)
    assert.equal(auth.sessions.size, 0)
    assert.equal(auth.verifySession('pat-session-token'), null)
  })

  // -------------------------------------------------------------
  // TEST A: Brother Device Execution on Brother Machine
  // -------------------------------------------------------------
  test('Test A: Brother executes task on Brother PC and writes patze-local-proof.txt', async () => {
    const prompt = 'Inspect this repository. Create a file named patze-local-proof.txt containing: Patze local execution verified on Brother PC. Then show the git diff and report hostname, current working directory, node version, and git user name.'

    const res = await fetch(`${onlineUrl}/api/devices/${BROTHER_DEVICE_ID}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer brother-session-token',
      },
      body: JSON.stringify({
        workspace: brotherWorkspace,
        prompt,
      }),
    })

    assert.equal(res.status, 200)
    const data = await res.json()

    // 1. Physical verification on Brother's local disk
    const proofFile = join(brotherWorkspace, 'patze-local-proof.txt')
    assert.equal(existsSync(proofFile), true, 'Proof file must exist physically on Brother PC')
    const content = readFileSync(proofFile, 'utf-8').trim()
    assert.equal(content, 'Patze local execution verified on Brother PC')

    // 2. Brother's execution facts belong to Brother's machine
    assert.equal(data.deviceId, BROTHER_DEVICE_ID)
    assert.equal(data.requestedBy, 'brother')
    assert.equal(data.workspace, brotherWorkspace)
    assert.equal(data.facts.currentWorkingDirectory, brotherWorkspace)
    assert.ok(data.facts.hostname)
    assert.ok(data.facts.nodeVersion)

    // 3. Crucial Isolation: No file written to Pat's workspace!
    const patProofFile = join(patWorkspace, 'patze-local-proof.txt')
    assert.equal(existsSync(patProofFile), false, 'Brother execution must never touch Pat workspace')
  })

  // -------------------------------------------------------------
  // TEST B: Pat Device Execution on Pat Machine
  // -------------------------------------------------------------
  test('Test B: Pat executes task on Pat PC without touching Brother workspace', async () => {
    const prompt = 'Inspect this repository. Create a file named patze-local-proof.txt containing: Patze local execution verified on Pat PC.'

    const res = await fetch(`${onlineUrl}/api/devices/${PAT_DEVICE_ID}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer pat-session-token',
      },
      body: JSON.stringify({
        workspace: patWorkspace,
        prompt,
      }),
    })

    assert.equal(res.status, 200)
    const data = await res.json()

    // 1. File written on Pat's workspace
    const patProofFile = join(patWorkspace, 'patze-local-proof.txt')
    assert.equal(existsSync(patProofFile), true, 'Proof file must exist on Pat PC')
    const content = readFileSync(patProofFile, 'utf-8').trim()
    assert.equal(content, 'Patze local execution verified on Pat PC')

    // 2. Brother's file remains untouched with Brother's content
    const brotherProofFile = join(brotherWorkspace, 'patze-local-proof.txt')
    assert.equal(readFileSync(brotherProofFile, 'utf-8').trim(), 'Patze local execution verified on Brother PC')
  })

  // -------------------------------------------------------------
  // TEST C: Cross-User Isolation (Server Authority Denies Mismatches)
  // -------------------------------------------------------------
  test('Test C: Cross-user access is strictly DENIED by server authority', async () => {
    // 1. Brother account -> Pat device_id = DENIED (403)
    const brotherAttemptsPat = await fetch(`${onlineUrl}/api/devices/${PAT_DEVICE_ID}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer brother-session-token',
      },
      body: JSON.stringify({
        workspace: patWorkspace,
        prompt: 'Malicious attempt to run on Pat device',
      }),
    })

    assert.equal(brotherAttemptsPat.status, 403)
    const err1 = await brotherAttemptsPat.json()
    assert.equal(err1.error, 'CROSS_USER_ACCESS_DENIED')

    // 2. Pat account -> Brother device_id = DENIED (403)
    const patAttemptsBrother = await fetch(`${onlineUrl}/api/devices/${BROTHER_DEVICE_ID}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer pat-session-token',
      },
      body: JSON.stringify({
        workspace: brotherWorkspace,
        prompt: 'Malicious attempt to run on Brother device',
      }),
    })

    assert.equal(patAttemptsBrother.status, 403)
    const err2 = await patAttemptsBrother.json()
    assert.equal(err2.error, 'CROSS_USER_ACCESS_DENIED')
  })

  // -------------------------------------------------------------
  // TEST D: Offline Device Handling (No Fallback to Pat PC or Cloud)
  // -------------------------------------------------------------
  test('Test D: Stopped host transitions to offline and fails without fallback', async () => {
    // 1. Stop Brother's local host daemon
    brotherHost.stop()

    // Allow registry to register disconnection
    await new Promise(r => setTimeout(r, 200))

    const deviceRecord = onlineServer.registry.getDeviceForUser(BROTHER_DEVICE_ID, 'brother')
    assert.equal(deviceRecord.ok, true)
    assert.equal(deviceRecord.device.status, 'offline')

    // 2. Brother attempts execution while host is stopped
    const res = await fetch(`${onlineUrl}/api/devices/${BROTHER_DEVICE_ID}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer brother-session-token',
      },
      body: JSON.stringify({
        workspace: brotherWorkspace,
        prompt: 'Should fail because device is offline',
      }),
    })

    assert.equal(res.status, 503)
    const data = await res.json()
    assert.equal(data.error, 'DEVICE_OFFLINE')
    assert.match(data.message, /cloud\/cross-device fallback is strictly prohibited/i)
  })

  // -------------------------------------------------------------
  // TEST E: Reconnect Resumes Allowed Session
  // -------------------------------------------------------------
  test('Test E: Restarted host returns online and resumes session without reconfiguration', async () => {
    // Restart Brother's local host daemon using the same persisted identity
    await brotherHost.start()
    await new Promise(r => setTimeout(r, 300))

    const deviceRecord = onlineServer.registry.getDeviceForUser(BROTHER_DEVICE_ID, 'brother')
    assert.equal(deviceRecord.ok, true)
    assert.equal(deviceRecord.device.status, 'online')

    // Execute new task now that device is back online
    const res = await fetch(`${onlineUrl}/api/devices/${BROTHER_DEVICE_ID}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer brother-session-token',
      },
      body: JSON.stringify({
        workspace: brotherWorkspace,
        prompt: 'Create a file named patze-local-proof.txt containing: Brother PC Reconnected Successfully.',
      }),
    })

    assert.equal(res.status, 200)
    const proofFile = join(brotherWorkspace, 'patze-local-proof.txt')
    assert.equal(readFileSync(proofFile, 'utf-8').trim(), 'Brother PC Reconnected Successfully')
  })

  // -------------------------------------------------------------
  // TEST F: Workspace Traversal Boundary Safety
  // -------------------------------------------------------------
  test('Test F: Workspace guard denies path traversal attacks', () => {
    const guard = new LocalWorkspaceGuard(brotherWorkspace)

    // Normal safe path
    const safePath = guard.resolveSafePath('sub/file.txt')
    assert.equal(safePath, join(brotherWorkspace, 'sub/file.txt'))

    // Traversal attack
    assert.throws(() => {
      guard.resolveSafePath('../../../etc/passwd')
    }, /WORKSPACE_TRAVERSAL_DENIED/)

    assert.throws(() => {
      guard.resolveSafePath('/outside/system/path')
    }, /WORKSPACE_TRAVERSAL_DENIED/)
  })

  test('Test F2: Workspace guard rejects symlinks that lead outside the root', t => {
    const guard = new LocalWorkspaceGuard(brotherWorkspace)
    const link = join(brotherWorkspace, 'outside-link')
    try {
      symlinkSync(tempBaseDir, link, 'dir')
    } catch (error) {
      if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
        return t.skip('Windows requires symlink privileges for this check')
      }
      throw error
    }
    assert.throws(() => guard.resolveSafePath('outside-link/pat-workspace'), /WORKSPACE_SYMLINK_DENIED/)
  })

  test('Test F3: Workspace guard bounds remote file reads and directory listings', () => {
    const guard = new LocalWorkspaceGuard(brotherWorkspace)
    guard.writeFile('small-read.txt', 'ok')
    assert.equal(guard.readFile('small-read.txt'), 'ok')
    const smallListing = guard.listFiles('.')
    assert.ok(smallListing.entries.some(entry => entry.name === 'small-read.txt'))
    assert.equal(smallListing.truncated, undefined)

    guard.writeFile('large-read.txt', 'x'.repeat(2 * 1024 * 1024 + 1))
    assert.throws(
      () => guard.readFile('large-read.txt'),
      error => error.code === 'FILE_TOO_LARGE',
    )

    guard.mkdir('many-entries')
    for (let index = 0; index < 1001; index++) {
      guard.writeFile(`many-entries/${index}.txt`, '')
    }
    const listing = guard.listFiles('many-entries')
    assert.equal(listing.entries.length, 1000)
    assert.equal(listing.truncated, true)

    if (process.platform !== 'win32') {
      const fifo = join(brotherWorkspace, 'workspace-pipe')
      execFileSync('mkfifo', [fifo])
      assert.throws(
        () => guard.readFile('workspace-pipe'),
        error => error.code === 'WORKSPACE_FILE_TYPE_DENIED',
      )
      assert.throws(
        () => guard.writeFile('workspace-pipe', 'unsafe'),
        error => error.code === 'WORKSPACE_FILE_TYPE_DENIED',
      )
    }
  })

  // -------------------------------------------------------------
  // TEST G: Device Listing Filtering
  // -------------------------------------------------------------
  test('Test G: Device listing strictly filters to the authenticated user', async () => {
    // Brother only sees Brother PC
    const resBrother = await fetch(`${onlineUrl}/api/devices`, {
      headers: { 'Authorization': 'Bearer brother-session-token' },
    })
    assert.equal(resBrother.status, 200)
    const dataBrother = await resBrother.json()
    assert.equal(dataBrother.devices.length, 1)
    assert.equal(dataBrother.devices[0].deviceId, BROTHER_DEVICE_ID)

    // Pat only sees Pat PC
    const resPat = await fetch(`${onlineUrl}/api/devices`, {
      headers: { 'Authorization': 'Bearer pat-session-token' },
    })
    assert.equal(resPat.status, 200)
    const dataPat = await resPat.json()
    assert.equal(dataPat.devices.length, 1)
    assert.equal(dataPat.devices[0].deviceId, PAT_DEVICE_ID)
  })

  // -------------------------------------------------------------
  // TEST H: Arbitrary Workspace Outside allowedWorkspaces Is Denied
  // -------------------------------------------------------------
  test('Test H: Requesting arbitrary directory outside allowedWorkspaces fails closed', async () => {
    const res = await fetch(`${onlineUrl}/api/devices/${BROTHER_DEVICE_ID}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer brother-session-token',
      },
      body: JSON.stringify({
        workspace: '/etc',
        prompt: 'Attempt to execute outside allowed workspace',
      }),
    })

    const data = await res.json()
    assert.ok(res.status >= 400 || data.error)
    assert.match(JSON.stringify(data), /WORKSPACE_NOT_PERMITTED/i)
  })

  // -------------------------------------------------------------
  // TEST I: User Authentication, Login & Session Cookie
  // -------------------------------------------------------------
  test('Test I: Login rejects wrong password and issues session cookie on valid credentials', async () => {
    // 1. Wrong password returns 401
    const failRes = await fetch(`${onlineUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'brother', password: 'wrong-password' }),
    })
    assert.equal(failRes.status, 401)

    // 2. Correct password returns 200 and Set-Cookie
    const successRes = await fetch(`${onlineUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'brother', password: TEST_AUTH_USERS.brother.password }),
    })
    assert.equal(successRes.status, 200)
    const data = await successRes.json()
    assert.equal(data.ok, true)
    assert.equal(data.user.id, 'brother')
    assert.ok(data.token)

    const cookie = successRes.headers.get('set-cookie')
    assert.ok(cookie)
    assert.match(cookie, /patze_session=patze_sess_/)
    assert.match(cookie, /HttpOnly/)
  })

  test('Secure cookie mode marks login and logout cookies Secure', async () => {
    const secureServer = new PatzeOnlineServer({ port: 0, authUsers: TEST_AUTH_USERS, secureCookies: true })
    const info = await secureServer.listen()
    try {
      const login = await fetch(`${info.url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username: 'brother', password: TEST_AUTH_USERS.brother.password }),
      })
      assert.equal(login.status, 200)
      const cookie = login.headers.get('set-cookie')
      assert.match(cookie, /; Secure(?:;|$)/)
      const { token } = await login.json()

      const logout = await fetch(`${info.url}/logout`, {
        redirect: 'manual',
        headers: { Cookie: `patze_session=${token}` },
      })
      assert.equal(logout.status, 302)
      assert.match(logout.headers.get('set-cookie'), /; Secure(?:;|$)/)
    } finally {
      await secureServer.close()
    }
  })

  // -------------------------------------------------------------
  // TEST J: One-Time Bootstrap Token Exchange
  // -------------------------------------------------------------
  test('Test J: Bootstrap token is one-time use and immediately invalidated', async () => {
    // 1. Create a bootstrap token for Pat
    const createRes = await fetch(`${onlineUrl}/api/auth/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'pat', secret: TEST_AUTH_USERS.pat.pairingSecret }),
    })
    assert.equal(createRes.status, 200)
    const { bootstrapToken } = await createRes.json()
    assert.ok(bootstrapToken.startsWith('boot_'))

    // 2. First consumption succeeds and redirects with cookie
    const consumeRes1 = await fetch(`${onlineUrl}/auth/bootstrap?token=${bootstrapToken}`, {
      redirect: 'manual',
    })
    assert.equal(consumeRes1.status, 302)
    assert.equal(consumeRes1.headers.get('location'), '/')
    const setCookie = consumeRes1.headers.get('set-cookie')
    assert.match(setCookie, /patze_session=patze_sess_/)

    // 3. Second consumption MUST fail (cannot reuse one-time bootstrap token)
    const consumeRes2 = await fetch(`${onlineUrl}/auth/bootstrap?token=${bootstrapToken}`, {
      redirect: 'manual',
    })
    assert.equal(consumeRes2.status, 302)
    assert.match(consumeRes2.headers.get('location'), /\/login\?error=/)
  })

  // -------------------------------------------------------------
  // TEST K: Unauthenticated Browser Dashboard Request Redirects to /login
  // -------------------------------------------------------------
  test('Test K: Unauthenticated dashboard request redirects to /login', async () => {
    const res = await fetch(`${onlineUrl}/`, {
      redirect: 'manual',
    })
    assert.equal(res.status, 302)
    assert.equal(res.headers.get('location'), '/login')
  })

  // -------------------------------------------------------------
  // TEST L: Live Operational Monitor Endpoint & Stats API
  // -------------------------------------------------------------
  test('Test L: Operational monitor renders HTML and returns telemetry stats', async () => {
    // 1. Unauthenticated request to /monitor redirects to /login
    const unauthRes = await fetch(`${onlineUrl}/monitor`, { redirect: 'manual' })
    assert.equal(unauthRes.status, 302)
    assert.equal(unauthRes.headers.get('location'), '/login')

    // 2. Authenticated request to /monitor renders HTML dashboard
    const authHtmlRes = await fetch(`${onlineUrl}/monitor`, {
      headers: { Cookie: 'patze_session=pat-session-token' },
    })
    assert.equal(authHtmlRes.status, 200)
    const html = await authHtmlRes.text()
    assert.match(html, /Live Monitor — Patze Control Plane/)
    assert.match(html, /Physical Host Nodes/)
    assert.match(html, /Live Operational Audit Stream/)

    // 3. Authenticated stats API returns structured JSON
    const statsRes = await fetch(`${onlineUrl}/api/monitor/stats`, {
      headers: { Cookie: 'patze_session=pat-session-token' },
    })
    assert.equal(statsRes.status, 200)
    const stats = await statsRes.json()
    assert.ok(stats.server)
    assert.ok(stats.stats)
    assert.ok(Array.isArray(stats.devices))
    assert.ok(Array.isArray(stats.sessions))
    // 4. Peat (non-admin) access to /monitor is denied with 403
    const peatHtmlRes = await fetch(`${onlineUrl}/monitor`, {
      headers: { Cookie: 'patze_session=peat-session-token' },
    })
    assert.equal(peatHtmlRes.status, 403)

    // 5. Peat (non-admin) access to /api/monitor/stats is denied with 403
    const peatStatsRes = await fetch(`${onlineUrl}/api/monitor/stats`, {
      headers: { Cookie: 'patze_session=peat-session-token' },
    })
    assert.equal(peatStatsRes.status, 403)
  })

  // -------------------------------------------------------------
  // TEST M: High-Entropy Production Credentials for Pat and Peat
  // -------------------------------------------------------------
  test('Test M: Configured user passwords authenticate cleanly', async () => {
    // 1. Pat login with strong password
    const patRes = await fetch(`${onlineUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'pat', password: TEST_AUTH_USERS.pat.password }),
    })
    assert.equal(patRes.status, 200)
    const patData = await patRes.json()
    assert.equal(patData.ok, true)
    assert.equal(patData.user.id, 'pat')

    // 2. Peat login with strong password
    const peatRes = await fetch(`${onlineUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'peat', password: TEST_AUTH_USERS.peat.password }),
    })
    assert.equal(peatRes.status, 200)
    const peatData = await peatRes.json()
    assert.equal(peatData.ok, true)
    assert.equal(peatData.user.id, 'peat')
  })

  // -------------------------------------------------------------
  // TEST N: Shared DSH Routes Are Restricted to Admin
  // -------------------------------------------------------------
  test('Test N: Shared DSH routes are restricted to admin', async () => {
    let mockRequestCount = 0
    // Upstream mock that serves a mock index.html
    const mockHarness = http.createServer((req, res) => {
      mockRequestCount++
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<!DOCTYPE html><html><head><title>Test</title></head><body><div id="root"></div></body></html>')
    })
    await new Promise(r => mockHarness.listen(0, '127.0.0.1', r))
    const mockPort = mockHarness.address().port
    const prevPort = onlineServer.harnessPort
    onlineServer.harnessPort = mockPort

    try {
      // 1. Render for Pat (admin): should have Live Monitor, should NOT have Host Devices
      const patRes = await fetch(`${onlineUrl}/`, {
        headers: { Cookie: 'patze_session=pat-session-token' },
      })
      assert.equal(patRes.status, 200)
      const patHtml = await patRes.text()
      assert.ok(!patHtml.includes('Host Devices'), 'HUD must not contain Host Devices')
      assert.ok(patHtml.includes('Live Monitor'), 'Admin HUD must contain Live Monitor')

      // 2. Render for Peat (non-admin): should NOT have Live Monitor, should NOT have Host Devices
      const peatRes = await fetch(`${onlineUrl}/`, {
        headers: { Cookie: 'patze_session=peat-session-token' },
        redirect: 'manual',
      })
      assert.equal(peatRes.status, 302)
      assert.equal(peatRes.headers.get('location'), '/dashboard')

      const privateApiRes = await fetch(`${onlineUrl}/api/private-harness-endpoint`, {
        headers: { Cookie: 'patze_session=peat-session-token' },
      })
      assert.equal(privateApiRes.status, 401)
      assert.equal(mockRequestCount, 1, 'Non-admin routes must not reach the shared DSH instance')

      const staticAssetRes = await fetch(`${onlineUrl}/assets/app.js`, {
        headers: { Cookie: 'patze_session=peat-session-token' },
      })
      assert.equal(staticAssetRes.status, 403)
      assert.equal(mockRequestCount, 1, 'Non-admin static paths must not reach the shared DSH instance')
    } finally {
      onlineServer.harnessPort = prevPort
      mockHarness.close()
    }
  })

  // -------------------------------------------------------------
  test('Test O: Terminal command execution directly on user local host', async () => {
    // Brother PC executes terminal command
    const res = await fetch(`${onlineUrl}/api/devices/${BROTHER_DEVICE_ID}/terminal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'patze_session=brother-session-token',
      },
      body: JSON.stringify({
        command: 'node -e "console.log(\'Brother Terminal Active\')"',
      }),
    })

    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.success, true)
    assert.equal(json.executionScope, 'PHYSICAL_LOCAL_HOST')
    assert.ok(json.terminalResult, 'Should contain terminalResult')
    assert.equal(json.terminalResult.exitCode, 0)
    assert.ok(json.terminalResult.stdout.includes('Brother Terminal Active'))
  })

  test('Test O2: Remote terminal execution stays disabled without local opt-in', async () => {
    const unapprovedHost = new PatzeHostRunner({
      onlineUrl: 'http://127.0.0.1:4000',
      deviceId: 'unapproved-host',
      userId: 'brother',
      secret: TEST_AUTH_USERS.brother.pairingSecret,
      allowedWorkspaces: [brotherWorkspace],
    })
    await assert.rejects(
      unapprovedHost._executeLocalTask({ workspace: brotherWorkspace, command: 'node -e "process.exit(0)"' }),
      error => error.code === 'REMOTE_TERMINAL_DISABLED',
    )
  })

  test('Test O2b: Host rejects workspaces outside its configured roots', async () => {
    const restrictedHost = new PatzeHostRunner({
      onlineUrl: 'http://127.0.0.1:4000',
      deviceId: 'restricted-host',
      userId: 'brother',
      secret: TEST_AUTH_USERS.brother.pairingSecret,
      allowedWorkspaces: [brotherWorkspace],
    })
    await assert.rejects(
      restrictedHost._executeLocalTask({ workspace: join(brotherWorkspace, '..', 'outside'), action: 'list_files' }),
      error => error.code === 'WORKSPACE_NOT_PERMITTED',
    )
  })

  test('Test O2c: Online rejects oversized write requests', async () => {
    const response = await fetch(`${onlineUrl}/api/devices/${BROTHER_DEVICE_ID}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'patze_session=brother-session-token',
      },
      body: JSON.stringify({
        action: 'write_file',
        file: 'oversized-request.txt',
        content: 'x'.repeat(1024 * 1024),
      }),
    })
    assert.equal(response.status, 413)
    assert.equal((await response.json()).error, 'PAYLOAD_TOO_LARGE')
    assert.equal(existsSync(join(brotherWorkspace, 'oversized-request.txt')), false)
  })

  test('Test O3: Local terminal command does not block the Host event loop', async () => {
    const guard = new LocalWorkspaceGuard(brotherWorkspace)
    let timerFired = false
    const timer = setTimeout(() => {
      timerFired = true
    }, 10)

    try {
      const result = await guard.runCommand('node -e "setTimeout(() => console.log(\'finished\'), 100)"')
      assert.equal(result.ok, true)
      assert.ok(timerFired, 'Host timers must continue while a local command runs')
    } finally {
      clearTimeout(timer)
    }
  })

  test('Test O4: Paired terminal output stays within tunnel frame bounds', async () => {
    const guard = new LocalWorkspaceGuard(brotherWorkspace)
    const result = await guard.runCommand('node -e "process.stdout.write(\'x\'.repeat(600 * 1024))"')
    assert.equal(result.ok, false)
    assert.ok(result.stdout.length <= 512 * 1024)
  })

  test('Test O5: Paired DSH proxy bounds response reads', async () => {
    const mockHarness = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('x'.repeat(2 * 1024 * 1024 + 1))
    })
    await new Promise(r => mockHarness.listen(0, '127.0.0.1', r))
    const proxyHost = new PatzeHostRunner({
      onlineUrl: 'http://127.0.0.1:4000',
      deviceId: 'proxy-host',
      userId: 'brother',
      secret: TEST_AUTH_USERS.brother.pairingSecret,
      localHarnessUrl: `http://127.0.0.1:${mockHarness.address().port}`,
      allowedWorkspaces: [brotherWorkspace],
    })
    let uplinkFrame
    proxyHost._sendUplinkFrame = async frame => { uplinkFrame = frame }

    try {
      await proxyHost._handleDownlinkFrame({
        type: 'request',
        id: 'large-response',
        method: 'GET',
        path: '/large',
      })
      assert.equal(uplinkFrame.status, 502)
      assert.equal(uplinkFrame.body.error, 'LOCAL_RESPONSE_TOO_LARGE')
    } finally {
      mockHarness.close()
    }
  })

  // -------------------------------------------------------------
  test('Test P: Workflow folder creation and filesystem management on local host', async () => {
    // 1. Create a workflow folder on Brother PC
    const mkdirRes = await fetch(`${onlineUrl}/api/devices/${BROTHER_DEVICE_ID}/fs/mkdir`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'patze_session=brother-session-token',
      },
      body: JSON.stringify({
        folder: 'workflows/daily-sync',
      }),
    })
    assert.equal(mkdirRes.status, 200)

    // 2. Verify folder exists physically in brotherWorkspaceDir
    const expectedDir = join(brotherWorkspace, 'workflows', 'daily-sync')
    assert.ok(existsSync(expectedDir), 'Workflow folder must exist on Brother physical disk')

    // 3. Write a workflow config file into the folder
    const writeRes = await fetch(`${onlineUrl}/api/devices/${BROTHER_DEVICE_ID}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'patze_session=brother-session-token',
      },
      body: JSON.stringify({
        action: 'write_file',
        file: 'workflows/daily-sync/workflow.json',
        content: JSON.stringify({ name: 'Daily Sync', schedule: '0 9 * * *' }),
      }),
    })
    assert.equal(writeRes.status, 200)
    const expectedFile = join(expectedDir, 'workflow.json')
    assert.ok(existsSync(expectedFile), 'Workflow file must exist on Brother physical disk')
  })

  // -------------------------------------------------------------
  test('Test Q: Remote web proxy does not claim ownership of the local Host', async () => {
    const mockHarness = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<!DOCTYPE html><html><head><title>Harness</title></head><body><div id="root"></div></body></html>')
    })
    await new Promise(r => mockHarness.listen(0, '127.0.0.1', r))
    const mockPort = mockHarness.address().port
    const prevPort = onlineServer.harnessPort
    onlineServer.harnessPort = mockPort

    try {
      const res = await fetch(`${onlineUrl}/`, {
        headers: { Cookie: 'patze_session=pat-session-token' },
      })
      assert.equal(res.status, 200)
      const html = await res.text()
      assert.ok(html.includes('Patze'), 'HTML must keep the Patze navigation injection')
      assert.ok(!html.includes('ownsHost: true'), 'A remote proxy must not claim ownership of the local Host')
    } finally {
      onlineServer.harnessPort = prevPort
      mockHarness.close()
    }
  })
})
