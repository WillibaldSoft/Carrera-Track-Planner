import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { UpdateError, sha256, compareVersions } from './release.mjs'
const exec = promisify(execFile)
export const APP_ENTRIES = [
  'dist',
  'updater',
  'standalone-server.mjs',
  'launcher.mjs',
  'LICENSE',
  'NOTICE',
  'LICENSES',
  'SOURCE.txt',
  'README.md',
  'THIRD-PARTY-NOTICES.txt',
]
const required = [
  'dist/index.html',
  'dist/release.json',
  'standalone-server.mjs',
  'launcher.mjs',
  'updater/engine.mjs',
  'updater/release.mjs',
  'updater/service.mjs',
  'updater/restart.mjs',
  'LICENSE',
  'NOTICE',
  'SOURCE.txt',
]
const permitted = (name) =>
  typeof name === 'string' &&
  !name.includes('\\') &&
  !name.includes(':') &&
  !name
    .split('/')
    .some(
      (p) =>
        !p ||
        p === '.' ||
        p === '..' ||
        p.startsWith('.') ||
        /[. ]$/.test(p) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p),
    ) &&
  APP_ENTRIES.some(
    (top) => name === top || (['dist', 'updater', 'LICENSES'].includes(top) && name.startsWith(top + '/')),
  )
export function validateBundle(bundle, version, nodeVersion = process.versions.node) {
  if (
    bundle?.kind !== 'carrera-planner.update' ||
    bundle.format !== 1 ||
    bundle.version !== version ||
    compareVersions(nodeVersion, bundle.minimumNode ?? '999.0.0') < 0
  )
    throw new UpdateError('incompatible')
  const names = Object.keys(bundle.files ?? {})
  if (names.length > 400 || !required.every((n) => names.includes(n))) throw new UpdateError('integrity')
  const folded = new Set()
  for (const name of names) {
    const lower = name.toLowerCase()
    if (folded.has(lower)) throw new UpdateError('integrity')
    folded.add(lower)
  }
  for (const name of names) {
    const segments = name.toLowerCase().split('/')
    for (let i = 1; i < segments.length; i++)
      if (folded.has(segments.slice(0, i).join('/'))) throw new UpdateError('integrity')
  }
  const decoded = new Map()
  let total = 0
  for (const name of names) {
    const entry = bundle.files[name]
    if (!permitted(name) || !entry || !/^([a-f0-9]{64})$/.test(entry.sha256) || typeof entry.data !== 'string')
      throw new UpdateError('integrity')
    const data = Buffer.from(entry.data, 'base64')
    total += data.length
    if (total > 64000000 || data.toString('base64') !== entry.data || sha256(data) !== entry.sha256)
      throw new UpdateError('integrity')
    decoded.set(name, data)
  }
  try {
    const release = JSON.parse(decoded.get('dist/release.json'))
    if (release.version !== version || release.application !== 'carrera-track-planner') throw Error()
  } catch {
    throw new UpdateError('integrity')
  }
  return decoded
}
export async function regularTree(root) {
  for (const item of await fs.readdir(root, { withFileTypes: true })) {
    const p = path.join(root, item.name)
    const stat = await fs.lstat(p)
    if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()))
      throw new UpdateError('unsupportedInstallation')
    if (stat.isDirectory()) await regularTree(p)
  }
}
export async function verifyBackup(job) {
  const hashes = JSON.parse(await fs.readFile(path.join(job.backup, 'backup-manifest.json'), 'utf8'))
  for (const [name, expected] of Object.entries(hashes)) {
    if (name !== 'plans.json' && (!name.startsWith('application/') || !permitted(name.slice(12))))
      throw new UpdateError('rollbackFailed')
    if (sha256(await fs.readFile(path.join(job.backup, name))) !== expected) throw new UpdateError('rollbackFailed')
  }
}
export async function restoreBackup(job) {
  await verifyBackup(job)
  for (const name of APP_ENTRIES) {
    const source = path.join(job.backup, 'application', name),
      target = path.join(job.appRoot, name)
    await fs.rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    try {
      await fs.cp(source, target, { recursive: true, errorOnExist: true, force: false })
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
    }
  }
}
export async function applyBundle({
  bundle,
  version,
  appRoot,
  dataDir,
  phase = () => {},
  rename = fs.rename,
  keepLock = false,
}) {
  const files = validateBundle(bundle, version)
  appRoot = await fs.realpath(appRoot)
  const lockPath = path.join(appRoot, '.planner-update.lock')
  let lock
  try {
    lock = await fs.open(lockPath, 'wx')
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: Date.now() }))
  } catch (e) {
    if (e.code === 'EEXIST') throw new UpdateError('busy')
    throw new UpdateError('backupFailed')
  }
  const stage = path.join(appRoot, `.update-${randomUUID()}`)
  const backup = path.join(dataDir, 'update-backups', `${Date.now()}-${randomUUID()}`)
  const job = {
    version,
    appRoot,
    dataDir,
    backup,
    oldPid: process.pid,
    port: Number(process.env.PORT) || 3180,
    createdAt: new Date().toISOString(),
  }
  let applying = false
  let completed = false
  let preserveLock = false
  try {
    await fs.mkdir(stage, { recursive: false })
    phase('verifying')
    for (const [name, data] of files) {
      const target = path.join(stage, name)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, data, { flag: 'wx' })
    }
    for (const name of files.keys())
      if (name.endsWith('.mjs'))
        try {
          await exec(process.execPath, ['--check', path.join(stage, name)], { timeout: 15000 })
        } catch {
          throw new UpdateError('incompatible')
        }
    phase('backup')
    await fs.mkdir(path.join(backup, 'application'), { recursive: true })
    for (const name of APP_ENTRIES) {
      const source = path.join(appRoot, name)
      try {
        const stat = await fs.lstat(source)
        if (stat.isSymbolicLink()) throw new UpdateError('unsupportedInstallation')
        if (stat.isDirectory()) await regularTree(source)
        await fs.cp(source, path.join(backup, 'application', name), {
          recursive: true,
          errorOnExist: true,
          force: false,
        })
      } catch (e) {
        if (e.code !== 'ENOENT') throw e
      }
    }
    // Independent snapshot, never restore over a user's newer saved layouts.
    try {
      await fs.copyFile(path.join(dataDir, 'plans.json'), path.join(backup, 'plans.json'))
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
    }
    const backupHashes = {}
    async function verifyCopy(source, destination, prefix) {
      const stat = await fs.lstat(source)
      if (stat.isDirectory()) {
        for (const name of await fs.readdir(source))
          await verifyCopy(path.join(source, name), path.join(destination, name), prefix + '/' + name)
      } else {
        const expected = sha256(await fs.readFile(source))
        if (
          sha256(
            await fs.readFile(destination).catch(() => {
              throw new UpdateError('backupFailed')
            }),
          ) !== expected
        )
          throw new UpdateError('backupFailed')
        backupHashes[prefix] = expected
      }
    }
    for (const name of APP_ENTRIES)
      try {
        await verifyCopy(path.join(appRoot, name), path.join(backup, 'application', name), 'application/' + name)
      } catch (e) {
        if (e.code !== 'ENOENT') throw e
      }
    try {
      await verifyCopy(path.join(dataDir, 'plans.json'), path.join(backup, 'plans.json'), 'plans.json')
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
    }
    await fs.writeFile(path.join(backup, 'backup-manifest.json'), JSON.stringify(backupHashes, null, 2), { flag: 'wx' })
    await fs.writeFile(path.join(backup, 'job.json'), JSON.stringify(job, null, 2), { flag: 'wx' })
    phase('installing', { backup })
    applying = true
    for (const name of APP_ENTRIES) {
      const target = path.join(appRoot, name),
        incoming = path.join(stage, name)
      try {
        await fs.rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
        await rename(incoming, target)
      } catch (e) {
        if (e.code !== 'ENOENT') throw e
      }
    }
    completed = true
    return job
  } catch (error) {
    if (applying) {
      try {
        await restoreBackup(job)
      } catch {
        preserveLock = true
        throw new UpdateError('rollbackFailed')
      }
    }
    if (error instanceof UpdateError) throw error
    throw new UpdateError(applying ? 'installFailed' : 'backupFailed')
  } finally {
    try {
      await fs.rm(stage, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    } finally {
      await lock.close()
      if (!preserveLock && (!completed || !keepLock)) await fs.rm(lockPath, { force: true })
    }
  }
}
