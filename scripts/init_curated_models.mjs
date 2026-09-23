#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const engine = join(root, 'engine/deepseek-harness')
const name = 'patze-curated'
const selected = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
const home = selected === '~' ? homedir() : selected.startsWith('~/') ? join(homedir(), selected.slice(2)) : selected
if (!isAbsolute(home)) throw new Error('DSH_HOME must be an absolute path or start with ~/')

const directory = join(home, 'profiles', name)
if (existsSync(directory)) throw new Error(`Profile already exists: ${directory}`)
if (!existsSync(join(engine, 'node_modules'))) throw new Error('Run pnpm setup before initializing models')

const result = spawnSync('pnpm', ['dsh', '--profile', name, '--from-default-profile', 'web', '--dump-config'], {
  cwd: engine,
  env: { ...process.env, DSH_HOME: home },
  encoding: 'utf8',
})
if (result.error) throw result.error
if (result.status !== 0) throw new Error(`Harness profile initialization failed; inspect ${directory} before retrying`)

const destination = join(directory, 'cordis.patch.yml')
if (!lstatSync(destination).isFile() || !readFileSync(destination, 'utf8').trimEnd().endsWith('[]')) {
  throw new Error(`New profile patch is not the expected empty template: ${destination}`)
}
const temporary = join(directory, 'cordis.patch.yml.patze-new')
writeFileSync(temporary, readFileSync(join(root, 'config/curated-models.patch.yml')), { flag: 'wx', mode: 0o600 })
renameSync(temporary, destination)
console.log(`Created opt-in profile ${name} at ${directory}`)
if (existsSync(join(home, 'cordis.patch.yml'))) {
  console.log('Note: the DSH home-level patch applies after this profile and may override its catalog.')
}
