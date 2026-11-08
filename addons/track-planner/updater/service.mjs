import fs from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { latestRelease, verifiedDownload, UpdateError } from './release.mjs'
import { applyBundle, restoreBackup } from './engine.mjs'
export async function createUpdateService({
  appRoot,
  dataDir,
  onRestart,
  fetchImpl = fetch,
  platform = process.platform,
  allowInstall,
} = {}) {
  const token = randomBytes(24).toString('hex')
  const stateFile = path.join(dataDir, 'update-state.json')
  let state = { phase: 'idle' },
    candidate = null,
    busy = false
  let interrupted = false
  const ownerAlive = (pid) => {
    if (!Number.isInteger(pid) || pid <= 0) return false
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
  try {
    state = JSON.parse(await fs.readFile(stateFile, 'utf8'))
    if (['downloading', 'verifying', 'backup', 'installing'].includes(state.phase) && !ownerAlive(state.ownerPid)) {
      state = { ...state, phase: 'interrupted', error: 'interrupted' }
      interrupted = true
    }
  } catch {}
  async function persist() {
    await fs.mkdir(dataDir, { recursive: true })
    const tmp = stateFile + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(state, null, 2))
    await fs.rename(tmp, stateFile)
  }
  if (interrupted) await persist()
  async function info() {
    if (!busy)
      try {
        state = JSON.parse(await fs.readFile(stateFile, 'utf8'))
      } catch {}
    const current = JSON.parse(await fs.readFile(path.join(appRoot, 'dist/release.json'), 'utf8')).version
    let marker
    try {
      marker = JSON.parse(await fs.readFile(path.join(appRoot, 'update-installation.json'), 'utf8'))
    } catch {}
    let writable = false
    if (
      (allowInstall === true || marker?.application === 'carrera-track-planner') &&
      marker?.distribution !== 'deb' &&
      ['linux', 'win32'].includes(platform) &&
      onRestart
    ) {
      const probe = path.join(appRoot, `.update-probe-${token}`)
      try {
        await fs.writeFile(probe, '', { flag: 'wx' })
        await fs.rm(probe)
        writable = true
      } catch {}
    }
    return {
      current,
      arch: process.arch,
      canInstall: writable && state.error !== 'rollbackFailed',
      platform,
      reason: writable ? null : marker?.distribution === 'deb' ? 'systemPackage' : 'manualOnly',
      token,
      state,
    }
  }
  async function check() {
    if (busy) throw new UpdateError('busy')
    const { current } = await info()
    candidate = await latestRelease(current, { fetchImpl })
    return { ...candidate, asset: undefined, checksum: undefined }
  }
  async function install({ version, confirmationToken }) {
    if (busy) throw new UpdateError('busy')
    if (confirmationToken !== token) throw new UpdateError('confirmationRequired')
    if (!(await info()).canInstall) throw new UpdateError('manualOnly')
    if (busy) throw new UpdateError('busy')
    if (!candidate?.available || !candidate.installable || candidate.version !== version)
      throw new UpdateError('changed')
    busy = true
    state = { phase: 'downloading', version, ownerPid: process.pid }
    await persist()
    const run = (async () => {
      let job
      try {
        const fresh = await latestRelease((await info()).current, { fetchImpl })
        if (!fresh.available || fresh.version !== version || fresh.asset?.digest !== candidate.asset?.digest)
          throw new UpdateError('changed')
        const bundle = await verifiedDownload(fresh, { fetchImpl })
        job = await applyBundle({
          bundle,
          version,
          appRoot,
          dataDir,
          keepLock: true,
          phase: (phase, details = {}) => {
            state = { ...state, ...details, phase }
          },
        })
        state = { phase: 'restarting', version, backup: job.backup }
        await persist()
        await onRestart(job)
      } catch (e) {
        if (job)
          try {
            await restoreBackup(job)
            await fs.rm(path.join(appRoot, '.planner-update.lock'), { force: true })
          } catch {
            e = new UpdateError('rollbackFailed')
          }
        state = { ...state, phase: 'failed', error: e.code ?? 'installFailed' }
        await persist()
        busy = false
      }
    })()
    // Keep a handled promise for tests and controlled shutdowns.
    run.catch(() => {
      busy = false
      state = { phase: 'failed', error: 'installFailed' }
    })
    return { accepted: true }
  }
  return {
    info,
    check,
    install,
    get busy() {
      return busy
    },
    get state() {
      return state
    },
  }
}
