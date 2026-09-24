import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { launchDesktopPreview, preparePatzeDesktopProfile } from './launcher.js'

function createRepository(root) {
  mkdirSync(join(root, 'config'), { recursive: true })
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(join(root, 'config', 'cordis.yml'), [
    '- id: web',
    '  config:',
    '    searchProvider: patze-search',
    '- insert:',
    '    - id: patze-core',
    '      name: ../src/index.js',
    '',
  ].join('\n'))
  writeFileSync(join(root, 'src', 'index.js'), 'export const name = "patze-core"\n')
}

test('creates an isolated profile overlay that loads Patze source and is idempotent', () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'patze-desktop-preview-'))
  try {
    const repositoryRoot = join(temporaryDirectory, 'repo')
    const profileDirectory = join(temporaryDirectory, 'profile')
    createRepository(repositoryRoot)

    const first = preparePatzeDesktopProfile({ profileDirectory, repositoryRoot })
    const firstContents = readFileSync(first.profilePatch, 'utf8')
    assert.equal(first.created, true)
    assert.match(firstContents, /searchProvider: patze-search/)
    assert.ok(firstContents.includes(`name: ${JSON.stringify(resolve(repositoryRoot, 'src', 'index.js'))}`))

    const second = preparePatzeDesktopProfile({ profileDirectory, repositoryRoot })
    assert.equal(second.created, false)
    assert.equal(readFileSync(second.profilePatch, 'utf8'), firstContents)
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
})

test('refuses to replace an existing profile patch without Patze integration', () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'patze-desktop-preview-'))
  try {
    const repositoryRoot = join(temporaryDirectory, 'repo')
    const profileDirectory = join(temporaryDirectory, 'profile')
    createRepository(repositoryRoot)
    mkdirSync(profileDirectory, { recursive: true })
    const profilePatch = join(profileDirectory, 'cordis.patch.yml')
    writeFileSync(profilePatch, '- id: web\n  config:\n    port: 3100\n')
    const before = readFileSync(profilePatch, 'utf8')

    assert.throws(
      () => preparePatzeDesktopProfile({ profileDirectory, repositoryRoot }),
      /refusing to replace existing profile settings/,
    )
    assert.equal(readFileSync(profilePatch, 'utf8'), before)
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
})

test('launches only on macOS and configures isolated DSH and artifact paths', async () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'patze-desktop-preview-'))
  try {
    const repositoryRoot = join(temporaryDirectory, 'repo')
    const engineDirectory = join(repositoryRoot, 'engine')
    createRepository(repositoryRoot)
    let launch
    const spawnProcess = (command, args, options) => {
      launch = { command, args, options }
      const child = new EventEmitter()
      queueMicrotask(() => child.emit('exit', 0, null))
      return child
    }
    const code = await launchDesktopPreview({
      repositoryRoot,
      engineDirectory,
      platform: 'darwin',
      homeDirectory: temporaryDirectory,
      environment: { npm_execpath: '/pnpm.cjs' },
      spawnProcess,
      writeOutput: () => {},
      writeError: () => {},
    })

    assert.equal(code, 0)
    assert.deepEqual(launch.args, ['/pnpm.cjs', '--dir', engineDirectory, 'run', 'dev:desktop'])
    assert.equal(launch.options.env.DSH_HOME, join(temporaryDirectory, 'Library', 'Application Support', 'Patze Preview', 'dsh-home'))
    assert.equal(launch.options.env.PATZE_ARTIFACTS_DIR, join(temporaryDirectory, 'Library', 'Application Support', 'Patze Preview', 'artifacts'))
    assert.equal(launch.options.env.DSH_DESKTOP_OPEN_DEVTOOLS, '0')
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
})

test('rejects non-macOS launch before creating preview state', async () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'patze-desktop-preview-'))
  try {
    const repositoryRoot = join(temporaryDirectory, 'repo')
    createRepository(repositoryRoot)
    let spawned = false
    let error = ''
    const code = await launchDesktopPreview({
      repositoryRoot,
      engineDirectory: join(repositoryRoot, 'engine'),
      platform: 'linux',
      environment: {},
      spawnProcess: () => { spawned = true },
      writeError: (message) => { error = message },
    })

    assert.equal(code, 1)
    assert.equal(spawned, false)
    assert.match(error, /runs on macOS/)
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
})
