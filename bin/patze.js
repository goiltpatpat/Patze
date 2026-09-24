#!/usr/bin/env node
import { spawn, execFileSync, execSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const engineDir = resolve(rootDir, 'engine/deepseek-harness')
const enginePkg = resolve(engineDir, 'package.json')
const cordisPatch = resolve(rootDir, 'config/cordis.yml')

// Smart Auto-Bootstrap: If submodule is uninitialized, automatically initialize it
if (!existsSync(enginePkg)) {
  console.log('\x1b[36m%s\x1b[0m', '⚡ [Patze] Initializing DeepSeek Harness engine submodule...')
  try {
    execSync('git submodule update --init --recursive', {
      cwd: rootDir,
      stdio: 'inherit',
    })
  } catch {
    console.error('\x1b[31m%s\x1b[0m', '❌ [Patze] Failed to initialize submodules. Please run: git submodule update --init --recursive')
    process.exit(1)
  }
}

// Check if engine node_modules exist, auto-install if missing
const engineNodeModules = resolve(engineDir, 'node_modules')
if (!existsSync(engineNodeModules)) {
  console.log('\x1b[36m%s\x1b[0m', '📦 [Patze] Engine dependencies not found. Installing via pnpm...')
  try {
    execSync('pnpm install --frozen-lockfile', {
      cwd: engineDir,
      stdio: 'inherit',
    })
  } catch {
    console.error('\x1b[31m%s\x1b[0m', '❌ [Patze] Failed to install dependencies. Please run: pnpm --dir engine/deepseek-harness install --frozen-lockfile')
    process.exit(1)
  }
}

// Automatically load root .env credentials if present
const rootEnv = resolve(rootDir, '.env')
if (existsSync(rootEnv)) {
  try {
    const content = readFileSync(rootEnv, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["'](.*)["']$/, '$1')
        if (key && process.env[key] === undefined) {
          process.env[key] = val
        }
      }
    }
  } catch (err) {
    console.warn('\x1b[33m%s\x1b[0m', `⚠️ [Patze] Warning reading .env: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Smart Provider Alias Normalization (Gemini, Kimi/Moonshot, TypeSafe/Jev)
  if (process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    process.env.GOOGLE_API_KEY = process.env.GEMINI_API_KEY
  } else if (process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.GOOGLE_API_KEY
  }

  if (process.env.KIMI_API_KEY && !process.env.MOONSHOT_API_KEY) {
    process.env.MOONSHOT_API_KEY = process.env.KIMI_API_KEY
  } else if (process.env.MOONSHOT_API_KEY && !process.env.KIMI_API_KEY) {
    process.env.KIMI_API_KEY = process.env.MOONSHOT_API_KEY
  }

  if (process.env.TYPESAFE_API_KEY && !process.env.JEV_API_KEY) {
    process.env.JEV_API_KEY = process.env.TYPESAFE_API_KEY
  } else if (process.env.JEV_API_KEY && !process.env.TYPESAFE_API_KEY) {
    process.env.TYPESAFE_API_KEY = process.env.JEV_API_KEY
  }
}

// Ensure Skill Discovery searches Patze's root .agents/skills directory
process.env.DSH_AGENTS_HOME ??= resolve(rootDir, '.agents')

const args = process.argv.slice(2)

// Native macOS Desktop preview using DSH's Electron shell and Patze's local profile overlay.
if (args[0] === 'desktop-preview') {
  const { launchDesktopPreview } = await import('../apps/desktop-preview/launcher.js')
  const exitCode = await launchDesktopPreview({ repositoryRoot: rootDir, engineDirectory: engineDir })
  process.exit(exitCode)
}

// Local and agent are explicit aliases for the full DeepSeek Harness Web Host.
// The web profile owns its settings and agent runtime on this machine.
const localAgentMode = args[0] === 'local' || args[0] === 'agent'
if (localAgentMode) args.shift()

// Fast-path: Patze Online Control Plane Server
if (args[0] === 'online') {
  let port = 4000
  const portIdx = args.indexOf('--port')
  if (portIdx !== -1 && args[portIdx + 1]) {
    port = parseInt(args[portIdx + 1], 10)
  }
  const { PatzeOnlineServer } = await import('../src/online/server.js')
  const server = new PatzeOnlineServer({ port })
  const info = await server.listen()
  console.log('\x1b[36m%s\x1b[0m', '⚡ [Patze Online] Control plane & device gateway online')
  console.log(`🌐 Web UI Login: ${info.url}/login`)
  console.log(`📡 Reverse Tunnel: ${info.url}/tunnel/connect`)
  console.log(`🔒 Alpha Accounts: pat / brother (zero permanent tokens in URLs)`)

  // Forward process termination
  const cleanup = async () => {
    await server.close()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // Keep process alive
  await new Promise(() => {})
}

// Fast-path: Patze Local Host Pairing Command
if (args[0] === 'host' && args[1] === 'pair') {
  const { getDefaultConfigPath, pairLocalHost } = await import('../src/host/pairing.js')
  let onlineUrl = 'http://127.0.0.1:4000'
  let userId = 'pat'
  let deviceName = ''
  let deviceId = ''
  let workspaces = [process.cwd()]

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--online' && args[i + 1]) onlineUrl = args[++i]
    else if (args[i] === '--user' && args[i + 1]) userId = args[++i]
    else if (args[i] === '--device' && args[i + 1]) deviceId = args[++i]
    else if (args[i] === '--name' && args[i + 1]) deviceName = args[++i]
    else if (args[i] === '--workspace' && args[i + 1]) workspaces = [args[++i]]
  }

  const secret = process.env[`PATZE_${userId.toUpperCase()}_PAIRING_SECRET`]
  if (!secret) {
    console.error(`Set PATZE_${userId.toUpperCase()}_PAIRING_SECRET before pairing this device.`)
    process.exit(1)
  }

  try {
    const config = await pairLocalHost({
      onlineUrl,
      userId,
      secret,
      deviceId,
      deviceName,
      allowedWorkspaces: workspaces,
    })
    console.log('\x1b[32m%s\x1b[0m', '✅ [Patze Host] Device paired and saved successfully.')
    console.log(`Device ID: ${config.deviceId}`)
    console.log(`Device config: ${getDefaultConfigPath()}`)
    process.exit(0)
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', `❌ [Patze Host] Pairing failed: ${err.message}`)
    process.exit(1)
  }
}

// Fast-path: Patze Local Host Daemon
if (args[0] === 'host') {
  const { assertSecureOnlineUrl, loadDeviceConfig } = await import('../src/host/pairing.js')
  const { PatzeHostRunner } = await import('../src/host/runner.js')

  const config = loadDeviceConfig()
  let onlineUrl = config?.onlineUrl || 'http://127.0.0.1:4000'
  let userId = config?.userId || 'pat'
  let secret = ''
  let deviceId = config?.deviceId || ''
  let deviceName = config?.deviceName || ''
  let workspaces = config?.allowedWorkspaces || [process.cwd()]

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--online' && args[i + 1]) onlineUrl = args[++i]
    else if (args[i] === '--user' && args[i + 1]) userId = args[++i]
    else if (args[i] === '--device' && args[i + 1]) deviceId = args[++i]
    else if (args[i] === '--name' && args[i + 1]) deviceName = args[++i]
    else if (args[i] === '--workspace' && args[i + 1]) workspaces = [args[++i]]
  }

  secret = (config?.userId === userId ? config?.secret : '')
    || process.env[`PATZE_${userId.toUpperCase()}_PAIRING_SECRET`]

  if (!secret) {
    console.error(`No host secret configured. Pair first or set PATZE_${userId.toUpperCase()}_PAIRING_SECRET.`)
    process.exit(1)
  }
  if (!deviceId) {
    deviceId = `dev_${userId}_local`
  }
  if (!deviceName) {
    deviceName = `${userId.toUpperCase()} PC`
  }

  assertSecureOnlineUrl(onlineUrl)

  // Ensure device is registered on online server
  try {
    const pairEndpoint = new URL('/api/devices/pair', onlineUrl).toString()
    await fetch(pairEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        deviceId,
        deviceName,
        secret,
        allowedWorkspaces: workspaces,
      }),
    })
  } catch {}

  const runner = new PatzeHostRunner({
    onlineUrl,
    deviceId,
    userId,
    secret,
    deviceName,
    allowedWorkspaces: workspaces,
    allowRemoteTerminal: process.env.PATZE_ALLOW_REMOTE_TERMINAL === 'true',
  })

  runner.on('connected', (info) => {
    console.log('\x1b[32m%s\x1b[0m', `⚡ [Patze Local Host] Connected to Patze Online at ${info.onlineUrl}`)
    console.log(`💻 Device ID: ${info.deviceId} (${deviceName})`)
    console.log(`👤 Owner Account: ${userId}`)
    console.log(`📁 Allowed Workspace: ${workspaces.join(', ')}`)
    console.log('🔒 Agent runtime executing locally on this physical machine.')
  })

  runner.on('connection_lost', (err) => {
    console.warn('\x1b[33m%s\x1b[0m', `⚠️ [Patze Local Host] Connection lost: ${err.message}. Retrying...`)
  })

  await runner.start()

  const cleanup = () => {
    runner.stop()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // Keep process alive
  await new Promise(() => {})
}

// Fast-path: Jev System 1 Decision CLI Commands
if (args[0] === 'route' && args[1]) {
  const { JevEngine } = await import('../src/jev/engine.js')
  const engine = new JevEngine()
  const result = await engine.routeSkill(args.slice(1).join(' '))
  console.log('\x1b[35m%s\x1b[0m', '🧠 [Patze Jev System 1] Fast Skill Route Result:')
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

if (args[0] === 'guard' && args[1]) {
  const { JevEngine } = await import('../src/jev/engine.js')
  const engine = new JevEngine()
  const result = await engine.checkSafety(args.slice(1).join(' '))
  console.log('\x1b[33m%s\x1b[0m', '🛡️ [Patze Jev System 1] Safety Guardrail Result:')
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

if (args[0] === 'evaluate' && args[1]) {
  const { JevEngine } = await import('../src/jev/engine.js')
  const engine = new JevEngine()
  const outputText = args[1]
  const contract = args.slice(2).join(' ') || 'execution succeeds without errors'
  const result = await engine.evaluateProof(outputText, contract)
  console.log('\x1b[36m%s\x1b[0m', '⚖️ [Patze Jev System 1] Proof Evaluation Result:')
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

if (args[0] === 'imagine-video' && args[1]) {
  const { generateImagineVideo } = await import('../src/tools/xai-imagine.js')
  const result = await generateImagineVideo({
    prompt: args.slice(1).join(' '),
    duration_seconds: 5,
    aspect_ratio: '16:9',
    resolution: '480p',
  })
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.success ? 0 : 1)
}

if (args[0] === 'imagine-image' && args[1]) {
  const { generateImagineImage } = await import('../src/tools/xai-imagine.js')
  const result = await generateImagineImage({
    prompt: args.slice(1).join(' '),
    aspect_ratio: '1:1',
  })
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.success ? 0 : 1)
}

if (args[0] === 'route-tools' && args[1]) {
  const { routeTools } = await import('../src/jev/router.js')
  const sampleTools = [
    { name: 'read' }, { name: 'write' }, { name: 'edit' }, { name: 'bash' },
    { name: 'glob' }, { name: 'grep' }, { name: 'present' }, { name: 'ask_user_question' },
    { name: 'job_output' }, { name: 'job_kill' }, { name: 'web_search' }, { name: 'fetch_web_page' },
    { name: 'xai_imagine_image' }, { name: 'xai_imagine_video' }, { name: 'ast_grep' },
  ]
  const routed = await routeTools({
    userText: args.slice(1).join(' '),
    tools: sampleTools,
    turn: 1,
    step: 1,
    bypassCache: true,
  })
  console.log('\x1b[35m%s\x1b[0m', '🧠 [Patze Jev System 1] Turn-Level Tool Routing Result:')
  console.log(JSON.stringify(routed.map(t => t.name), null, 2))
  process.exit(0)
}

if (args[0] === 'rerank' && args[1]) {
  const { JevEngine } = await import('../src/jev/engine.js')
  const engine = new JevEngine()
  const query = args[1]
  let candidates = []
  let policy = 'authoritative'
  let topK

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--policy' && args[i + 1]) {
      policy = args[++i]
    } else if (args[i] === '--top' && args[i + 1]) {
      topK = parseInt(args[++i], 10)
    } else if (!candidates.length) {
      try {
        candidates = JSON.parse(args[i])
      } catch {
        candidates = [{ id: '1', text: args.slice(i).join(' ') }]
        break
      }
    }
  }

  const result = await engine.rerankCandidates(query, candidates, { policy, topK })
  console.log('\x1b[35m%s\x1b[0m', '🎯 [Patze Jev Steerable Reranker] Result:')
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

if (args[0] === 'verify-citation' && args[1] && args[2]) {
  const { JevEngine } = await import('../src/jev/engine.js')
  const engine = new JevEngine()
  const claim = args[1]
  const sourceText = args.slice(2).join(' ')
  const result = await engine.verifyCitation(claim, sourceText)
  console.log('\x1b[35m%s\x1b[0m', '🔍 [Patze Jev Citation Verification] Result:')
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

if (args[0] === 'gate' && args[1]) {
  const { JevEngine } = await import('../src/jev/engine.js')
  const engine = new JevEngine()
  const result = await engine.evaluateRequestGate(args.slice(1).join(' '))
  console.log('\x1b[35m%s\x1b[0m', '🚪 [Patze Jev Gate Evaluator] Result:')
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

if (args[0] === 'dispatch' && args[1]) {
  const { resolveClosedSetAction } = await import('../src/jev/cascade.js')
  const result = resolveClosedSetAction(args.slice(1).join(' '))
  console.log('\x1b[35m%s\x1b[0m', '🎯 [Patze Jev Closed-Set Dispatcher] Result:')
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

if (args[0] === 'fallback-card' && args[1]) {
  const { JevEngine } = await import('../src/jev/engine.js')
  const engine = new JevEngine()
  const request = args[1]
  const err = args.slice(2).join(' ') || 'Provider 503 Outage'
  const result = await engine.handleProviderFailure(request, err)
  console.log('\x1b[33m%s\x1b[0m', '🛡️ [Patze Jev Circuit Breaker Fallback Card] Result:')
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

if (args[0] === 'stats' || args[0] === 'economy') {
  console.log('\x1b[36m%s\x1b[0m', '⚡ [Patze Architecture] Token Efficiency & System 1 Engine Status:')
  console.log('  • DeepSeek Harness Spill Policy: Active (Spill threshold: 50,000 bytes to disk)')
  console.log('  • DeepSeek Harness Tool Result Pruner: Active (Pruning window: 8,192 chars)')
  console.log('  • DeepSeek Harness Image Offload: Active (Vision token auto-reclamation)')
  console.log('  • DeepSeek Harness Compaction: Active (Context window lifecycle + /compact)')
  console.log('  • Patze Jev AgentShield Gate: Active (Zero-token pre-execution safety check)')
  console.log('  • Patze Jev Proof Diagnostic Gate: Active (Zero-token post-execution watcher)')
  console.log('  • Patze Jev Intent Router: Active (Conversational fast-path + calibrated skill gating)')
  console.log('  • Patze Jev Turn-Held Tool Router: Active (Nitro architecture, prompt cache preservation, -40% tokens)')
  console.log('  • Patze Jev Steerable Reranker: Active (64-concurrency policy-driven chunk scoring)')
  console.log('  • Patze Jev Citation Stance Verifier: Active (supports / contradicts / unaddressed)')
  process.exit(0)
}

// Fast-path: Update and synchronize Patpat skills from upstream repository
if (args[0] === 'update-skills' || args[0] === 'sync-skills') {
  console.log('\x1b[36m%s\x1b[0m', '🔍 [Patze] Verifying the pinned Patpat skill copy...')
  try {
    execFileSync('python3', ['scripts/verify_patpat_skills.py'], { cwd: rootDir, stdio: 'inherit' })
    console.log('\x1b[36m%s\x1b[0m', '🔄 [Patze] Updating Patpat submodule from upstream (main)...')
    execSync('git submodule update --remote plugins/patpat', {
      cwd: rootDir,
      stdio: 'inherit',
    })
    const check = spawnSync('python3', ['scripts/verify_patpat_skills.py'], { cwd: rootDir, stdio: 'ignore' })
    if (check.error) throw check.error
    if (check.status !== 0) {
      const backupRoot = resolve(rootDir, 'tmp')
      mkdirSync(backupRoot, { recursive: true })
      const backup = resolve(backupRoot, `patpat-skills-${Date.now()}-${process.pid}`)
      console.log('\x1b[36m%s\x1b[0m', `📦 [Patze] Updating owned Patpat skills; backup: ${backup}`)
      execFileSync('python3', [
        'plugins/patpat/scripts/update_skills.py',
        '--target', '.agents/skills', '--backup', backup,
      ], { cwd: rootDir, stdio: 'inherit' })
    }
    execFileSync('python3', ['scripts/verify_patpat_skills.py'], { cwd: rootDir, stdio: 'inherit' })
    console.log('\x1b[32m%s\x1b[0m', '✅ [Patze] Patpat skills update completed successfully!')
    process.exit(0)
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', `❌ [Patze] Failed to update skills: ${err.message}`)
    process.exit(1)
  }
}

// Assemble DSH command line with automatic Cordis patch overlay
// Assemble DSH command line: launcher options (--profile, --patch) must precede app arguments
let profile = 'web'
let workspace = process.env.PATZE_WORKSPACE || process.cwd()
const remainingArgs = []

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === 'web' || arg === 'headless' || arg === 'rescue') {
    profile = arg
  } else if (arg === '--profile' && args[i + 1]) {
    profile = args[++i]
  } else if (localAgentMode && arg === '--workspace') {
    if (!args[i + 1]) {
      console.error('Usage: pnpm local [--workspace <existing-directory>] [DSH options]')
      process.exit(1)
    }
    workspace = args[++i]
  } else {
    remainingArgs.push(arg)
  }
}

const localWorkspace = resolve(workspace)
if (localAgentMode && (!existsSync(localWorkspace) || !statSync(localWorkspace).isDirectory())) {
  console.error(`Patze workspace must be an existing directory: ${localWorkspace}`)
  process.exit(1)
}

// Token Economy & Profile Hygiene: ensure clean web bundle profile unless --team is explicitly requested
const homeDir = process.env.HOME || process.env.USERPROFILE || ''
const webProfilePkg = resolve(homeDir, '.dsh/profiles/web/package.json')
if (profile === 'web' && !remainingArgs.includes('--team') && existsSync(webProfilePkg)) {
  try {
    const pkgData = JSON.parse(readFileSync(webProfilePkg, 'utf-8'))
    const bundles = pkgData?.dsh?.profile?.bundles
    if (Array.isArray(bundles)) {
      const cleanBundles = bundles.filter(b => !b.includes('experimental-agent-team'))
      if (cleanBundles.length !== bundles.length) {
        pkgData.dsh.profile.bundles = cleanBundles
        writeFileSync(webProfilePkg, JSON.stringify(pkgData, null, 2) + '\n')
      }
    }
  } catch {
    // Non-blocking
  }
}

const dshArgs = ['--profile', profile]
if (!remainingArgs.includes('--patch') && existsSync(cordisPatch)) {
  dshArgs.push('--patch', cordisPatch)
}
dshArgs.push(...remainingArgs)

const engineRequire = createRequire(enginePkg)
const tsxLoader = engineRequire.resolve('tsx/esm')
const proc = spawn(process.execPath, ['--import', tsxLoader, resolve(engineDir, 'apps/cli/src/bin.ts'), ...dshArgs], {
  cwd: localAgentMode ? localWorkspace : engineDir,
  stdio: 'inherit',
  env: process.env,
})

// Forward termination signals to child process
const handleSignal = (signal) => {
  if (!proc.killed) {
    proc.kill(signal)
  }
}

process.on('SIGINT', () => handleSignal('SIGINT'))
process.on('SIGTERM', () => handleSignal('SIGTERM'))

proc.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', `❌ [Patze] Process error: ${err.message}`)
  process.exit(1)
})

proc.on('exit', (code) => {
  process.exit(code ?? 0)
})
