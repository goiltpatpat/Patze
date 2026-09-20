#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

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

// Assemble DSH command line with automatic Cordis patch overlay
const dshArgs = [...args]

// If --patch is not explicitly supplied by user and cordis.yml exists, inject it
if (!dshArgs.includes('--patch') && existsSync(cordisPatch)) {
  dshArgs.push('--patch', cordisPatch)
}

// Default to 'web' profile if no profile or sub-command specified
if (dshArgs.length === 0 || (dshArgs.length === 2 && dshArgs[0] === '--patch')) {
  dshArgs.unshift('web')
}

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
