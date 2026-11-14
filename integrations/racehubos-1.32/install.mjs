import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { randomUUID, createHash } from 'node:crypto'
import { validateAddonBundle } from '../../addons/track-planner/updater/addon.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const owned = [
  'server/index.js',
  'server/planner-updates.js',
  'server/planner-updater/addon.mjs',
  'server/planner-updater/release.mjs',
]

export function registerPlannerUpdates(source) {
  const imported = "import {createPlannerUpdatesRouter} from './planner-updates.js';"
  const registration =
    "  ctx.app.use('/api/addons/track-planner/updates', await createPlannerUpdatesRouter({sessionService:ctx.services.session}));"
  const hasImport = source.includes(imported),
    hasRegistration = source.includes(registration)
  if (hasImport && hasRegistration) return source
  if (hasImport || hasRegistration) throw Error('Incomplete planner update registration; inspect server/index.js')
  const imports = "import express from 'express';"
  const mount = "  ctx.app.use('/api/addons', legacyAddons);"
  if (source.split(imports).length !== 2 || source.split(mount).length !== 2)
    throw Error('Unsupported carrera-local server registration; no files changed')
  return source.replace(imports, imports + '\n' + imported).replace(mount, registration + '\n' + mount)
}
async function copyChecked(source, target) {
  const stat = await fs.lstat(source)
  if (stat.isSymbolicLink()) throw Error('Unexpected symlink in application files: ' + source)
  if (stat.isDirectory()) {
    await fs.mkdir(target, { recursive: true })
    for (const name of await fs.readdir(source)) await copyChecked(path.join(source, name), path.join(target, name))
  } else if (stat.isFile()) {
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.copyFile(source, target)
    if (hash(await fs.readFile(source)) !== hash(await fs.readFile(target)))
      throw Error('Backup verification failed: ' + source)
  } else throw Error('Unsupported application file: ' + source)
}
export async function installRaceHubOSBridge({ host, approve, snapshotDatabase }) {
  host = await fs.realpath(host)
  if (JSON.parse(await fs.readFile(path.join(host, 'package.json'))).version !== '1.32.0')
    throw Error('This bridge supports RaceHubOS 1.32.0 with the carrera-local extension only')
  const addon = await fs.realpath(path.join(host, 'addons/carrera-local'))
  if (JSON.parse(await fs.readFile(path.join(addon, 'racehubos-addon.json'))).id !== 'carrera-local')
    throw Error('Unexpected extension')
  const version = JSON.parse(await fs.readFile(path.join(root, 'package.json'))).version
  const bundle = JSON.parse(await fs.readFile(path.join(root, 'addons/track-planner/track-planner.racehub-addon.json')))
  const files = validateAddonBundle(bundle, version)
  const entry = await fs.readFile(path.join(addon, 'server/index.js'), 'utf8')
  const registered = registerPlannerUpdates(entry)
  const backupBase = path.join(host, 'addons/.data/carrera-local/planner-bridge-backups')
  await fs.mkdir(backupBase, { recursive: true })
  const lock = await fs.open(path.join(backupBase, '.install.lock'), 'wx')
  const backup = path.join(backupBase, Date.now() + '-' + randomUUID())
  const old = new Set()
  let staged,
    changing = false
  const planner = path.join(addon, 'legacy-addons/track-planner')
  const dist = path.join(host, 'packages/frontend/dist')
  const cert = path.join(host, 'addons/.data/carrera-local/update-checks/approved.json')
  try {
    await fs.mkdir(backup)
    for (const name of owned) {
      try {
        await copyChecked(path.join(addon, name), path.join(backup, name))
        old.add(name)
      } catch (e) {
        if (e.code !== 'ENOENT') throw e
      }
    }
    await copyChecked(planner, path.join(backup, 'planner'))
    await copyChecked(dist, path.join(backup, 'host-build'))
    await copyChecked(cert, path.join(backup, 'approved.json'))
    if (snapshotDatabase) await snapshotDatabase(path.join(backup, 'racehubos.db'))
    else {
      const require = createRequire(path.join(host, 'packages/backend/package.json'))
      require('dotenv').config({ path: path.join(host, 'packages/backend/.env'), quiet: true })
      const { getDatabasePath } = await import(
        pathToFileURL(path.join(host, 'packages/backend/src/lib/database-url.js'))
      )
      const Database = require('better-sqlite3'),
        db = new Database(getDatabasePath(), { readonly: true })
      try {
        await db.backup(path.join(backup, 'racehubos.db'))
      } finally {
        db.close()
      }
    }
    staged = path.join(addon, 'legacy-addons/.planner-bootstrap-' + randomUUID())
    await fs.mkdir(staged)
    for (const [name, bytes] of files) {
      const target = path.join(staged, name)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, bytes, { flag: 'wx' })
    }
    await fs.writeFile(path.join(staged, 'manifest.json'), JSON.stringify(bundle.manifest, null, 2) + '\n')
    changing = true
    await fs.mkdir(path.join(addon, 'server/planner-updater'), { recursive: true })
    await copyChecked(
      path.join(root, 'integrations/racehubos-1.32/server/planner-updates.js'),
      path.join(addon, 'server/planner-updates.js'),
    )
    for (const name of ['addon.mjs', 'release.mjs'])
      await copyChecked(
        path.join(root, 'addons/track-planner/updater', name),
        path.join(addon, 'server/planner-updater', name),
      )
    await fs.writeFile(path.join(addon, 'server/index.js'), registered)
    await fs.rm(planner, { recursive: true })
    await fs.rename(staged, planner)
    staged = null
    const verify =
      approve ??
      (async () => {
        const { runRegressions } = await import(pathToFileURL(path.join(addon, 'tools/update-guard/run.mjs')))
        return runRegressions(host)
      })
    await verify(host)
    const report = { version, host, addon, backup, compatibilityChecks: 'passed', restartRequired: true }
    await fs.writeFile(path.join(backup, 'installed.json'), JSON.stringify(report, null, 2) + '\n')
    return report
  } catch (e) {
    if (changing) {
      try {
        for (const name of owned) {
          if (old.has(name)) await copyChecked(path.join(backup, name), path.join(addon, name))
          else await fs.rm(path.join(addon, name), { force: true })
        }
        // Remove an empty directory introduced by a first-time bridge install.
        try {
          await fs.rmdir(path.join(addon, 'server/planner-updater'))
        } catch (cleanup) {
          if (!['ENOTEMPTY', 'ENOENT'].includes(cleanup.code)) throw cleanup
        }
        await fs.rm(planner, { recursive: true, force: true })
        await copyChecked(path.join(backup, 'planner'), planner)
        await fs.rm(dist, { recursive: true, force: true })
        await copyChecked(path.join(backup, 'host-build'), dist)
        await copyChecked(path.join(backup, 'approved.json'), cert)
      } catch (rollback) {
        throw Error('Restoration failed; backup retained at ' + backup, { cause: rollback })
      }
    }
    throw e
  } finally {
    if (staged) await fs.rm(staged, { recursive: true, force: true })
    await lock.close()
    await fs.rm(path.join(backupBase, '.install.lock'), { force: true })
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw Error('Usage: node integrations/racehubos-1.32/install.mjs /path/to/RaceHubOS-1.32')
  console.log('Stop RaceHubOS before installation. Existing plans are backed up and retained.')
  console.log(JSON.stringify(await installRaceHubOSBridge({ host: process.argv[2] }), null, 2))
  console.log('Installation verified. Start RaceHubOS again.')
}
