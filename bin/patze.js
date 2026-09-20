#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const engineDir = resolve(__dirname, '../engine/deepseek-harness')

const args = process.argv.slice(2)
const proc = spawn('pnpm', ['dsh', ...args], {
  cwd: engineDir,
  stdio: 'inherit',
  env: process.env,
})

proc.on('exit', (code) => {
  process.exit(code ?? 0)
})
