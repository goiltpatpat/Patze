#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

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
    execSync('pnpm install', {
      cwd: engineDir,
      stdio: 'inherit',
    })
  } catch {
    console.error('\x1b[31m%s\x1b[0m', '❌ [Patze] Failed to install dependencies. Please run: pnpm --dir engine/deepseek-harness install')
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
  console.log('\x1b[36m%s\x1b[0m', '🔄 [Patze] Updating Patpat submodule from upstream (main)...')
  try {
    execSync('git submodule update --remote plugins/patpat', {
      cwd: rootDir,
      stdio: 'inherit',
    })
    console.log('\x1b[36m%s\x1b[0m', '📦 [Patze] Synchronizing skills into .agents/skills...')
    execSync('python3 -c "import shutil; from pathlib import Path; src=Path(\'plugins/patpat/skills\'); dst=Path(\'.agents/skills\'); [shutil.copytree(s, dst/s.name, dirs_exist_ok=True) for s in src.iterdir() if s.is_dir() and (s/\'SKILL.md\').is_file()]; print(\'✨ Successfully synchronized all Patpat skills.\')"', {
      cwd: rootDir,
      stdio: 'inherit',
    })
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
const remainingArgs = []

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === 'web' || arg === 'headless' || arg === 'rescue') {
    profile = arg
  } else if (arg === '--profile' && args[i + 1]) {
    profile = args[++i]
  } else {
    remainingArgs.push(arg)
  }
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

const proc = spawn('pnpm', ['dsh', ...dshArgs], {
  cwd: engineDir,
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
