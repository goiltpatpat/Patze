import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const CORE_ENTRY_PATTERN = 'name: ../src/index.js'

/** Create the Patze overlay in the isolated Desktop profile without replacing existing settings. */
export function preparePatzeDesktopProfile({ profileDirectory, repositoryRoot }) {
  const profilePatch = join(profileDirectory, 'cordis.patch.yml')
  const patzeEntry = resolve(repositoryRoot, 'src', 'index.js')
  const configPath = join(repositoryRoot, 'config', 'cordis.yml')
  const config = readFileSync(configPath, 'utf8')
  const occurrences = config.split(CORE_ENTRY_PATTERN).length - 1
  if (occurrences !== 1) {
    throw new Error(`Patze Desktop Preview: expected one ${JSON.stringify(CORE_ENTRY_PATTERN)} in ${configPath}`)
  }

  mkdirSync(profileDirectory, { recursive: true, mode: 0o700 })
  if (existsSync(profilePatch)) {
    const existing = readFileSync(profilePatch, 'utf8')
    if (existing.includes('id: patze-core') && existing.includes(patzeEntry)) {
      return { profilePatch, created: false }
    }
    throw new Error(
      `Patze Desktop Preview: refusing to replace existing profile settings at ${profilePatch}; `
      + 'choose an empty PATZE_DESKTOP_PREVIEW_HOME to keep this preview isolated.',
    )
  }

  const anchoredConfig = config.replace(CORE_ENTRY_PATTERN, `name: ${JSON.stringify(patzeEntry)}`)
  const contents = `# Patze Desktop Preview integration\n${anchoredConfig}`
  writeFileSync(profilePatch, contents, { flag: 'wx', mode: 0o600 })
  return { profilePatch, created: true }
}

/** Start DSH's unpackaged Electron Desktop with an isolated Patze profile on macOS. */
export async function launchDesktopPreview({
  repositoryRoot,
  engineDirectory,
  platform = process.platform,
  homeDirectory = homedir(),
  environment = process.env,
  spawnProcess = spawn,
  writeOutput = (message) => process.stdout.write(`${message}\n`),
  writeError = (message) => process.stderr.write(`${message}\n`),
}) {
  if (platform !== 'darwin') {
    writeError('Patze Desktop Preview runs on macOS. On this machine, use `pnpm local` for the local Web UI.')
    return 1
  }

  const packageManager = environment.npm_execpath
  if (typeof packageManager !== 'string' || packageManager === '') {
    writeError('Run `pnpm desktop:preview` so the workspace package manager can launch the Desktop shell.')
    return 1
  }

  const dataDirectory = resolve(environment.PATZE_DESKTOP_PREVIEW_HOME
    || join(homeDirectory, 'Library', 'Application Support', 'Patze Preview'))
  const dshHome = join(dataDirectory, 'dsh-home')
  const profileDirectory = join(dshHome, 'profiles', 'desktop')
  const { profilePatch, created } = preparePatzeDesktopProfile({ profileDirectory, repositoryRoot })
  const outputDirectory = join(dataDirectory, 'artifacts')

  writeOutput(`Patze Desktop Preview profile: ${profileDirectory}`)
  writeOutput(`Patze Desktop Preview artifacts: ${outputDirectory}`)
  if (created) writeOutput(`Patze Desktop Preview overlay: ${profilePatch}`)

  const childEnvironment = {
    ...environment,
    DSH_HOME: dshHome,
    DSH_AGENTS_HOME: environment.DSH_AGENTS_HOME || join(repositoryRoot, '.agents'),
    DSH_DESKTOP_OPEN_DEVTOOLS: environment.DSH_DESKTOP_OPEN_DEVTOOLS || '0',
    PATZE_ARTIFACTS_DIR: outputDirectory,
  }
  const child = spawnProcess(process.execPath, [packageManager, '--dir', engineDirectory, 'run', 'dev:desktop'], {
    cwd: repositoryRoot,
    env: childEnvironment,
    stdio: 'inherit',
  })

  return new Promise((resolveExit) => {
    child.once('error', (error) => {
      writeError(`Patze Desktop Preview could not start: ${error.message}`)
      resolveExit(1)
    })
    child.once('exit', (code, signal) => resolveExit(signal ? 1 : (code ?? 1)))
  })
}
