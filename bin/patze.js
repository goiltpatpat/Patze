#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const engineDir = resolve(rootDir, 'engine/deepseek-harness')
const enginePkg = resolve(engineDir, 'package.json')

// Smart Auto-Bootstrap: If submodule is uninitialized, automatically initialize it
if (!existsSync(enginePkg)) {
  console.log('\x1b[36m%s\x1b[0m', '⚡ [Patze] Initializing DeepSeek Harness engine submodule...')
  try {
    execSync('git submodule update --init --recursive', {
      cwd: rootDir,
      stdio: 'inherit',
    })
  } catch (err) {
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
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', '❌ [Patze] Failed to install dependencies. Please run: pnpm --dir engine/deepseek-harness install')
    process.exit(1)
  }
}

const args = process.argv.slice(2)
const proc = spawn('pnpm', ['dsh', ...args], {
  cwd: engineDir,
  stdio: 'inherit',
  env: process.env,
})

proc.on('exit', (code) => {
  process.exit(code ?? 0)
})
