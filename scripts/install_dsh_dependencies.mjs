import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const ENGINE_DIRECTORY = resolve(REPOSITORY_ROOT, 'engine', 'deepseek-harness')

const result = spawnSync('pnpm', ['install', '--frozen-lockfile'], {
  cwd: ENGINE_DIRECTORY,
  encoding: 'utf8',
  env: { ...process.env, CI: 'true' },
  stdio: 'inherit',
})

if (result.error) {
  console.error(`[Patze setup] Could not install DSH dependencies: ${result.error.message}`)
  process.exitCode = 1
} else if (result.status !== 0) {
  process.exitCode = result.status ?? 1
}
