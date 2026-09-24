import { resolve, normalize, isAbsolute, relative, sep } from 'node:path'
import { constants, existsSync, mkdirSync, writeFileSync, statSync, lstatSync, realpathSync, opendirSync, openSync, fstatSync, readSync, closeSync } from 'node:fs'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)
const MAX_FILE_READ_BYTES = 2 * 1024 * 1024
const MAX_DIRECTORY_ENTRIES = 1000
const MAX_DIRECTORY_LIST_BYTES = 4 * 1024 * 1024
const MAX_COMMAND_OUTPUT_BYTES = 512 * 1024
const NOFOLLOW_NONBLOCK_FLAGS = process.platform === 'win32'
  ? 0
  : (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0)

/**
 * Local Workspace Guard for Patze Local Host
 *
 * Enforces lexical workspace boundaries and rejects existing symlink components
 * for direct filesystem operations. Shell commands run as the logged-in OS user
 * and are not sandboxed by this class.
 */
export class LocalWorkspaceGuard {
  /**
   * @param {string} rootPath - Authoritative root directory for this workspace
   */
  constructor(rootPath) {
    if (!rootPath || typeof rootPath !== 'string') {
      throw new Error('Workspace rootPath must be a non-empty string')
    }
    const requestedRoot = resolve(normalize(rootPath))

    if (!existsSync(requestedRoot)) {
      mkdirSync(requestedRoot, { recursive: true })
    }
    this.root = realpathSync(requestedRoot)
  }

  /**
   * Resolve and assert that targetPath is within the workspace boundary
   * @param {string} targetPath
   * @returns {string} Absolute normalized safe path
   */
  resolveSafePath(targetPath) {
    if (!targetPath) return this.root

    const fullPath = isAbsolute(targetPath)
      ? resolve(normalize(targetPath))
      : resolve(this.root, normalize(targetPath))

    const rel = relative(this.root, fullPath)
    const isEscaping = rel.startsWith('..') || isAbsolute(rel)

    if (isEscaping && fullPath !== this.root) {
      const err = new Error(`[WORKSPACE_TRAVERSAL_DENIED] Access Denied: Path [${targetPath}] escapes workspace boundary [${this.root}]`)
      err.code = 'WORKSPACE_TRAVERSAL_DENIED'
      throw err
    }

    let current = this.root
    for (const segment of relative(this.root, fullPath).split(sep).filter(Boolean)) {
      current = resolve(current, segment)
      try {
        if (lstatSync(current).isSymbolicLink()) {
          const err = new Error(`[WORKSPACE_SYMLINK_DENIED] Access Denied: Path [${targetPath}] traverses a symbolic link`)
          err.code = 'WORKSPACE_SYMLINK_DENIED'
          throw err
        }
      } catch (err) {
        if (err.code === 'WORKSPACE_SYMLINK_DENIED') throw err
        if (err.code === 'ENOENT' || err.code === 'ENOTDIR') break
        throw err
      }
    }

    return fullPath
  }

  /**
   * Safe file write inside workspace
   * @param {string} relativeOrAbsolutePath
   * @param {string} content
   */
  writeFile(relativeOrAbsolutePath, content) {
    const safePath = this.resolveSafePath(relativeOrAbsolutePath)
    let exists = false
    try {
      const existingStat = lstatSync(safePath)
      if (!existingStat.isFile()) {
        const err = new Error(`Only regular files can be written: ${relativeOrAbsolutePath}`)
        err.code = 'WORKSPACE_FILE_TYPE_DENIED'
        throw err
      }
      exists = true
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }

    const flags = constants.O_WRONLY | NOFOLLOW_NONBLOCK_FLAGS | (exists
      ? constants.O_TRUNC
      : constants.O_CREAT | constants.O_EXCL)
    const fd = openSync(safePath, flags, 0o666)
    try {
      if (!fstatSync(fd).isFile()) {
        const err = new Error(`Only regular files can be written: ${relativeOrAbsolutePath}`)
        err.code = 'WORKSPACE_FILE_TYPE_DENIED'
        throw err
      }
      writeFileSync(fd, content, { encoding: 'utf8' })
    } finally {
      closeSync(fd)
    }
    return { ok: true, path: safePath, bytes: Buffer.byteLength(content) }
  }

  /**
   * Safe file read inside workspace
   * @param {string} relativeOrAbsolutePath
   */
  readFile(relativeOrAbsolutePath) {
    const safePath = this.resolveSafePath(relativeOrAbsolutePath)
    let fd
    try {
      if (!lstatSync(safePath).isFile()) {
        const err = new Error(`Only regular files can be read: ${relativeOrAbsolutePath}`)
        err.code = 'WORKSPACE_FILE_TYPE_DENIED'
        throw err
      }
      fd = openSync(safePath, constants.O_RDONLY | NOFOLLOW_NONBLOCK_FLAGS)
      const fileStat = fstatSync(fd)
      if (!fileStat.isFile()) {
        const err = new Error(`Only regular files can be read: ${relativeOrAbsolutePath}`)
        err.code = 'WORKSPACE_FILE_TYPE_DENIED'
        throw err
      }
      if (fileStat.size > MAX_FILE_READ_BYTES) {
        const err = new Error(`File exceeds the ${MAX_FILE_READ_BYTES / (1024 * 1024)} MiB remote read limit: ${relativeOrAbsolutePath}`)
        err.code = 'FILE_TOO_LARGE'
        err.status = 413
        throw err
      }

      const buffer = Buffer.alloc(MAX_FILE_READ_BYTES + 1)
      let bytesRead = 0
      while (bytesRead < buffer.length) {
        const count = readSync(fd, buffer, bytesRead, buffer.length - bytesRead, null)
        if (count === 0) break
        bytesRead += count
      }
      if (bytesRead > MAX_FILE_READ_BYTES) {
        const err = new Error(`File exceeds the ${MAX_FILE_READ_BYTES / (1024 * 1024)} MiB remote read limit: ${relativeOrAbsolutePath}`)
        err.code = 'FILE_TOO_LARGE'
        err.status = 413
        throw err
      }
      return buffer.subarray(0, bytesRead).toString('utf8')
    } catch (err) {
      if (err.code === 'ENOENT') {
        const notFound = new Error(`File not found: ${relativeOrAbsolutePath}`)
        notFound.code = 'ENOENT'
        throw notFound
      }
      throw err
    } finally {
      if (fd !== undefined) closeSync(fd)
    }
  }

  /**
   * Safe check existence
   * @param {string} relativeOrAbsolutePath
   */
  exists(relativeOrAbsolutePath) {
    try {
      const safePath = this.resolveSafePath(relativeOrAbsolutePath)
      return existsSync(safePath)
    } catch {
      return false
    }
  }

  /**
   * Safe directory creation (mkdir -p) inside workspace
   * @param {string} relativeOrAbsolutePath
   */
  mkdir(relativeOrAbsolutePath) {
    const safePath = this.resolveSafePath(relativeOrAbsolutePath)
    mkdirSync(safePath, { recursive: true })
    return { ok: true, path: safePath, relativePath: relative(this.root, safePath) || '.' }
  }

  /**
   * Safe directory listing inside workspace
   * @param {string} [subDirectory]
   */
  listFiles(subDirectory = '.') {
    const safePath = this.resolveSafePath(subDirectory)
    if (!existsSync(safePath)) {
      return { ok: true, directory: safePath, entries: [] }
    }
    const stat = statSync(safePath)
    if (!stat.isDirectory()) {
      return { ok: true, directory: safePath, entries: [{ name: relative(this.root, safePath), isDirectory: false, size: stat.size }] }
    }

    const directory = opendirSync(safePath)
    const items = []
    let bytes = 0
    let truncated = false
    try {
      let dirent
      while ((dirent = directory.readSync())) {
        const entry = {
          name: dirent.name,
          isDirectory: dirent.isDirectory(),
          relativePath: relative(this.root, resolve(safePath, dirent.name)),
        }
        const entryBytes = Buffer.byteLength(JSON.stringify(entry)) + (items.length === 0 ? 0 : 1)
        if (items.length >= MAX_DIRECTORY_ENTRIES || bytes + entryBytes > MAX_DIRECTORY_LIST_BYTES) {
          truncated = true
          break
        }
        items.push(entry)
        bytes += entryBytes
      }
    } finally {
      directory.closeSync()
    }
    return { ok: true, directory: safePath, entries: items, ...(truncated ? { truncated: true } : {}) }
  }

  /**
   * Execute a shell command with workspace as its working directory.
   * This runs with the logged-in OS user's full privileges; cwd is not a sandbox.
   * @param {string} command
   * @param {object} [options]
   * @param {number} [options.timeoutMs=25000]
   * @param {Record<string, string>} [options.env={}]
   * @param {string} [options.subDir]
   */
  async runCommand(command, { timeoutMs = 25000, env = {}, subDir = '.' } = {}) {
    if (!command || typeof command !== 'string') {
      throw new Error('Command must be a non-empty string')
    }
    const cwd = this.resolveSafePath(subDir)
    if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
      throw new Error(`Command working directory must be an existing directory inside the workspace: ${cwd}`)
    }
    const requestedTimeout = Number(timeoutMs)
    const boundedTimeout = Number.isFinite(requestedTimeout) && requestedTimeout > 0
      ? Math.min(requestedTimeout, 25_000)
      : 25_000
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: boundedTimeout,
        maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
        env: { ...process.env, ...env },
        encoding: 'utf8',
        windowsHide: true,
      })
      return {
        ok: true,
        exitCode: 0,
        stdout: stdout || '',
        stderr: stderr || '',
        cwd,
      }
    } catch (err) {
      return {
        ok: false,
        exitCode: Number.isInteger(err.code) ? err.code : 1,
        stdout: err.stdout ? String(err.stdout) : '',
        stderr: err.stderr ? String(err.stderr) : err.message,
        cwd,
      }
    }
  }
}
