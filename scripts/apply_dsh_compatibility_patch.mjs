import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..')
const ENGINE_DIRECTORY = resolve(REPOSITORY_ROOT, 'engine', 'deepseek-harness')
const PATCH_FILE = resolve(REPOSITORY_ROOT, 'patches', 'deepseek-harness-dsh-v0.1.7-rc.1.patch')
const EXPECTED_ENGINE_REVISION = '46a7f68b0922371ce7144b668b90e377d8e799f4'

function runGit(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args[0]} failed`).trim())
  }
  return result.stdout.trim()
}

function tryGit(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.error) throw result.error
  return result
}

export function applyDshCompatibilityPatch() {
  const pinnedRevision = runGit(
    ['rev-parse', 'HEAD:engine/deepseek-harness'],
    REPOSITORY_ROOT,
  )
  if (pinnedRevision !== EXPECTED_ENGINE_REVISION) {
    throw new Error(
      `Patze DSH compatibility patch targets ${EXPECTED_ENGINE_REVISION}; `
      + `the repository pins ${pinnedRevision}. Review the patch before updating the engine pin.`,
    )
  }

  const checkedOutRevision = runGit(['rev-parse', 'HEAD'], ENGINE_DIRECTORY)
  if (checkedOutRevision !== pinnedRevision) {
    throw new Error(
      `Patze DSH compatibility patch requires submodule ${pinnedRevision}; `
      + `the checked out engine is ${checkedOutRevision}. Run git submodule update --init engine/deepseek-harness.`,
    )
  }

  const alreadyApplied = tryGit(
    ['apply', '--reverse', '--check', '--unidiff-zero', PATCH_FILE],
    ENGINE_DIRECTORY,
  )
  if (alreadyApplied.status === 0) {
    console.log('Patze DSH compatibility patch already applied.')
    return
  }

  const applicable = tryGit(['apply', '--check', '--unidiff-zero', PATCH_FILE], ENGINE_DIRECTORY)
  if (applicable.status !== 0) {
    throw new Error(
      'Patze DSH compatibility patch does not apply cleanly. Preserve local changes and review the pinned engine source.',
    )
  }
  runGit(['apply', '--unidiff-zero', PATCH_FILE], ENGINE_DIRECTORY)
  console.log('Applied Patze DSH compatibility patch.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    applyDshCompatibilityPatch()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
