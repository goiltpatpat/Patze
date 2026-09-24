#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const patzeCli = fileURLToPath(new URL('./patze.js', import.meta.url))
const child = spawn(process.execPath, [patzeCli, 'local', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env,
})

child.on('error', (error) => {
  console.error(`Patze local host could not start: ${error.message}`)
  process.exitCode = 1
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1)
})
