import fs from 'node:fs/promises'
import path from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import { releaseSummary, fetchBytes, sha256, UpdateError } from './release.mjs'
const ASSET = 'track-planner.racehub-addon.json'
const PREFIX = 'https://github.com/WillibaldSoft/Carrera-Track-Planner/releases/download/'

export function addonRelease(release, current) {
  const result = releaseSummary(release, current)
  const prefix = PREFIX + release.tag_name + '/'
  const asset = release.assets?.find((a) => a.name === ASSET)
  const checksum = release.assets?.find((a) => a.name === 'SHA256SUMS')
  const valid = (a) => a?.state === 'uploaded' && a.browser_download_url === prefix + a.name
  return {
    ...result,
    asset,
    checksum,
    installable: !!(
      valid(asset) &&
      valid(checksum) &&
      /^sha256:[a-f0-9]{64}$/.test(asset.digest ?? '') &&
      asset.size > 0 &&
      asset.size <= 32000000
    ),
  }
}
export function validateAddonBundle(bundle, version) {
  const m = bundle?.manifest
  if (
    m?.id !== 'track-planner' ||
    m.hostApi !== 1 ||
    m.entry !== 'index.html' ||
    m.version !== version ||
    m.license !== 'AGPL-3.0-only' ||
    !m.files ||
    !bundle.files ||
    Array.isArray(m.files) ||
    Array.isArray(bundle.files)
  )
    throw new UpdateError('incompatible')
  const names = Object.keys(m.files),
    folded = new Set()
  if (
    !names.length ||
    names.length > 400 ||
    !names.includes('index.html') ||
    names.length !== Object.keys(bundle.files).length
  )
    throw new UpdateError('integrity')
  const files = new Map()
  let total = 0
  for (const name of names) {
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(name) ||
      name
        .split('/')
        .some(
          (p) =>
            !p ||
            p === '.' ||
            p === '..' ||
            p.startsWith('.') ||
            /[. ]$/.test(p) ||
            /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p),
        ) ||
      ['manifest.json', '.installation.json'].includes(name.toLowerCase()) ||
      folded.has(name.toLowerCase())
    )
      throw new UpdateError('integrity')
    folded.add(name.toLowerCase())
    const text = bundle.files[name]
    if (typeof text !== 'string' || text.length > 86000000) throw new UpdateError('integrity')
    const bytes = Buffer.from(text, 'base64')
    total += bytes.length
    if (bytes.toString('base64') !== text || total > 64000000 || sha256(bytes) !== m.files[name])
      throw new UpdateError('integrity')
    files.set(name, bytes)
  }
  for (const name of names) {
    const parts = name.toLowerCase().split('/')
    for (let i = 1; i < parts.length; i++)
      if (folded.has(parts.slice(0, i).join('/'))) throw new UpdateError('integrity')
  }
  return files
}
async function copyVerified(source, destination) {
  const stat = await fs.lstat(source)
  if (stat.isSymbolicLink()) throw new UpdateError('unsupportedInstallation')
  if (stat.isDirectory()) {
    await fs.mkdir(destination, { recursive: true })
    for (const name of await fs.readdir(source))
      await copyVerified(path.join(source, name), path.join(destination, name))
  } else if (stat.isFile()) {
    await fs.copyFile(source, destination)
    if (sha256(await fs.readFile(source)) !== sha256(await fs.readFile(destination)))
      throw new UpdateError('backupFailed')
  } else throw new UpdateError('backupFailed')
}
export async function createAddonUpdateService({
  directory,
  backupDir,
  readInstallation,
  beforeInstall = async () => {},
  approve = async () => {},
  afterRollback = async () => {},
  assertIdle = () => {},
  fetchImpl = fetch,
}) {
  const token = randomBytes(24).toString('hex')
  let candidate = null,
    busy = false,
    state = { phase: 'idle' }
  async function info() {
    const current = await readInstallation()
    return {
      current: current.version,
      canInstall: current.compatible && !state.recoveryFailed,
      hostManaged: true,
      platform: process.platform,
      token,
      state,
    }
  }
  async function check() {
    if (busy) throw new UpdateError('busy')
    const current = (await info()).current
    const bytes = await fetchBytes('https://api.github.com/repos/WillibaldSoft/Carrera-Track-Planner/releases/latest', {
      fetchImpl,
      limit: 1000000,
    })
    candidate = addonRelease(JSON.parse(bytes.toString('utf8')), current)
    return { ...candidate, asset: undefined, checksum: undefined }
  }
  async function install({ version, confirmationToken }) {
    if (busy) throw new UpdateError('busy')
    if (confirmationToken !== token) throw new UpdateError('confirmationRequired')
    assertIdle()
    if (!(await info()).canInstall || !candidate?.available || !candidate.installable || candidate.version !== version)
      throw new UpdateError('changed')
    if (busy) throw new UpdateError('busy')
    busy = true
    state = { phase: 'downloading', version }
    const run = async () => {
      let lock,
        backup,
        stage,
        applying = false
      try {
        await fs.mkdir(backupDir, { recursive: true })
        try {
          lock = await fs.open(path.join(backupDir, '.install.lock'), 'wx')
        } catch {
          throw new UpdateError('busy')
        }
        const latest = JSON.parse(
          (
            await fetchBytes('https://api.github.com/repos/WillibaldSoft/Carrera-Track-Planner/releases/latest', {
              fetchImpl,
              limit: 1000000,
            })
          ).toString('utf8'),
        )
        const fresh = addonRelease(latest, (await info()).current)
        if (
          !fresh.available ||
          fresh.version !== version ||
          !fresh.installable ||
          fresh.asset.digest !== candidate.asset.digest
        )
          throw new UpdateError('changed')
        const sums = (await fetchBytes(fresh.checksum.browser_download_url, { fetchImpl, limit: 200000 })).toString(
          'utf8',
        )
        const rows = sums
          .split(/\r?\n/)
          .map((l) => /^([a-f0-9]{64})\s+\*?(.+)$/.exec(l))
          .filter((r) => r?.[2] === ASSET)
        if (rows.length !== 1 || fresh.asset.digest !== 'sha256:' + rows[0][1]) throw new UpdateError('integrity')
        const bytes = await fetchBytes(fresh.asset.browser_download_url, { fetchImpl })
        if (bytes.length !== fresh.asset.size || sha256(bytes) !== rows[0][1]) throw new UpdateError('integrity')
        state = { ...state, phase: 'verifying' }
        const bundle = JSON.parse(bytes.toString('utf8')),
          files = validateAddonBundle(bundle, version)
        stage = path.join(path.dirname(directory), '.planner-stage-' + randomUUID())
        await fs.mkdir(stage)
        for (const [name, bytes] of files) {
          const p = path.join(stage, name)
          await fs.mkdir(path.dirname(p), { recursive: true })
          await fs.writeFile(p, bytes, { flag: 'wx' })
        }
        await fs.writeFile(path.join(stage, 'manifest.json'), JSON.stringify(bundle.manifest, null, 2) + '\n', {
          flag: 'wx',
        })
        state = { ...state, phase: 'backup' }
        backup = path.join(backupDir, Date.now() + '-' + randomUUID())
        await fs.mkdir(backup)
        await copyVerified(directory, path.join(backup, 'application'))
        await beforeInstall(backup)
        assertIdle()
        state = { ...state, phase: 'installing', backup }
        applying = true
        await fs.rm(directory, { recursive: true })
        await fs.rename(stage, directory)
        stage = null
        const installed = await readInstallation()
        if (!installed.compatible || installed.version !== version) throw new UpdateError('integrity')
        state = { ...state, phase: 'checkingHost' }
        await approve()
        state = { phase: 'complete', version, backup }
      } catch (e) {
        if (applying) {
          try {
            await fs.rm(directory, { recursive: true, force: true })
            await copyVerified(path.join(backup, 'application'), directory)
            await afterRollback(backup)
          } catch {
            state = { phase: 'failed', error: 'rollbackFailed', backup, recoveryFailed: true }
            return
          }
        }
        state = { phase: 'failed', error: e.code ?? 'installFailed', backup }
      } finally {
        if (stage) await fs.rm(stage, { recursive: true, force: true })
        if (lock) {
          await lock.close()
          await fs.rm(path.join(backupDir, '.install.lock'), { force: true })
        }
        busy = false
      }
    }
    run().catch(() => {
      state = { phase: 'failed', error: 'installFailed' }
      busy = false
    })
    return { accepted: true }
  }
  return {
    info,
    check,
    install,
    get state() {
      return state
    },
    get busy() {
      return busy
    },
  }
}
