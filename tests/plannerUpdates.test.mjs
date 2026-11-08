import { makeUpdateBundle } from './fixtures/updateBundle.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  compareVersions,
  releaseSummary,
  verifiedDownload,
  sha256,
  UPDATE_ASSET,
} from '../addons/track-planner/updater/release.mjs'
import { validateBundle, applyBundle, APP_ENTRIES } from '../addons/track-planner/updater/engine.mjs'
import { createUpdateService } from '../addons/track-planner/updater/service.mjs'
import { supervise } from '../addons/track-planner/updater/restart.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../addons/track-planner')
const bundle = (version='1.2.1') => makeUpdateBundle(version)
async function fixture() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'planner-update-test-')),
    appRoot = path.join(temp, 'app'),
    dataDir = path.join(temp, 'data')
  await fs.mkdir(appRoot)
  await fs.mkdir(dataDir)
  await fs.mkdir(path.join(appRoot, 'dist'))
  await fs.mkdir(path.join(appRoot, 'updater'))
  await fs.writeFile(path.join(appRoot, 'dist/release.json'), JSON.stringify({ version: '1.2.0' }))
  await fs.writeFile(path.join(appRoot, 'dist/index.html'), 'old UI')
  for (const n of ['engine', 'release', 'service', 'restart'])
    await fs.copyFile(path.join(root, 'updater/' + n + '.mjs'), path.join(appRoot, 'updater/' + n + '.mjs'))
  await fs.writeFile(path.join(appRoot, 'launcher.mjs'), '// old launcher')
  await fs.writeFile(path.join(appRoot, 'standalone-server.mjs'), '// old server')
  await fs.writeFile(path.join(appRoot, 'node'), 'runtime stays unchanged')
  await fs.writeFile(
    path.join(appRoot, 'update-installation.json'),
    JSON.stringify({ application: 'carrera-track-planner', distribution: 'portable' }),
  )
  await fs.writeFile(path.join(dataDir, 'plans.json'), 'saved user layouts')
  return { temp, appRoot, dataDir }
}
function releaseFixture(payload) {
  const bytes = Buffer.from(JSON.stringify(payload)),
    digest = sha256(bytes),
    prefix = 'https://github.com/WillibaldSoft/Carrera-Track-Planner/releases/download/v1.2.1/'
  const asset = (name, body) => ({
    name,
    state: 'uploaded',
    size: body.length,
    digest: 'sha256:' + sha256(body),
    browser_download_url: prefix + name,
  })
  const sums = Buffer.from(`${digest}  ${UPDATE_ASSET}\n`)
  const release = {
    tag_name: 'v1.2.1',
    draft: false,
    prerelease: false,
    body: '## Deutsch\nNeu\n## English\nNew\n## Français\nNouveau',
    assets: [asset(UPDATE_ASSET, bytes), asset('SHA256SUMS', sums)],
  }
  const fetchImpl = async (url) =>
    new Response(url.endsWith('/latest') ? JSON.stringify(release) : url.endsWith('/SHA256SUMS') ? sums : bytes, {
      status: 200,
    })
  return { bytes, sums, release, fetchImpl }
}
test('stable version selection rejects prereleases, downgrades and untrusted download URLs', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1)
  const r = { tag_name: 'v1.2.1', assets: [], draft: false, prerelease: false }
  assert.equal(releaseSummary(r, '1.3.0').available, false)
  assert.throws(() => releaseSummary({ ...r, prerelease: true }, '1.0.0'))
  assert.throws(() => releaseSummary({ ...r, tag_name: 'v2.0.0-beta' }, '1.0.0'))
  assert.equal(
    releaseSummary(
      {
        ...r,
        assets: [
          {
            name: UPDATE_ASSET,
            state: 'uploaded',
            browser_download_url: 'https://evil.invalid/update',
            size: 123,
            digest: 'sha256:' + 'a'.repeat(64),
          },
        ],
      },
      '1.0.0',
    ).installable,
    false,
  )
})
test('download checks both GitHub asset digest and published checksum, rejects corrupt bytes', async () => {
  const f = releaseFixture(await bundle()),
    summary = releaseSummary(f.release, '1.2.0')
  assert.equal((await verifiedDownload(summary, { fetchImpl: f.fetchImpl })).version, '1.2.1')
  await assert.rejects(
    verifiedDownload(
      { ...summary, asset: { ...summary.asset, digest: 'sha256:' + '0'.repeat(64) } },
      { fetchImpl: f.fetchImpl },
    ),
    (e) => e.code === 'integrity',
  )
  await assert.rejects(
    verifiedDownload(summary, {
      fetchImpl: async (url) => new Response(url.endsWith('SHA256SUMS') ? f.sums : Buffer.from('corrupted')),
    }),
    (e) => e.code === 'integrity',
  )
  await assert.rejects(
    verifiedDownload(summary, { fetchImpl: async () => new Response('limited', { status: 429 }) }),
    (e) => e.code === 'rateLimit',
  )
})
test('update payload refuses traversal, runtime replacement, missing files, conflicting paths and bad file hashes', async () => {
  const good = await bundle()
  for (const name of ['../plans.json', 'dist/../../node', 'node', 'dist/CON', 'dist/a.', 'dist/x\\y']) {
    const bad = structuredClone(good)
    bad.files[name] = { data: 'eA==', sha256: sha256('x') }
    assert.throws(() => validateBundle(bad, '1.2.1'))
  }
  const bad = structuredClone(good)
  bad.files['dist/index.html'].sha256 = '0'.repeat(64)
  assert.throws(() => validateBundle(bad, '1.2.1'))
  const missing = structuredClone(good)
  delete missing.files['updater/restart.mjs']
  assert.throws(() => validateBundle(missing, '1.2.1'))
  const conflict = structuredClone(good)
  conflict.files['dist/INDEX.html'] = conflict.files['dist/index.html']
  assert.throws(() => validateBundle(conflict, '1.2.1'))
  assert.throws(() => validateBundle({ ...good, minimumNode: '99.0.0' }, '1.2.1'))
})
test('verified install snapshots application and saved tracks while preserving runtime and data', async () => {
  const f = await fixture()
  try {
    const job = await applyBundle({ ...f, bundle: await bundle(), version: '1.2.1' })
    assert.equal(JSON.parse(await fs.readFile(path.join(f.appRoot, 'dist/release.json'))).version, '1.2.1')
    assert.equal(await fs.readFile(path.join(job.backup, 'application/dist/index.html'), 'utf8'), 'old UI')
    assert.equal(await fs.readFile(path.join(job.backup, 'plans.json'), 'utf8'), 'saved user layouts')
    assert.equal(await fs.readFile(path.join(f.dataDir, 'plans.json'), 'utf8'), 'saved user layouts')
    assert.equal(await fs.readFile(path.join(f.appRoot, 'node'), 'utf8'), 'runtime stays unchanged')
  } finally {
    await fs.rm(f.temp, { recursive: true, force: true })
  }
})
test('a filesystem install failure rolls back all changed app entries and does not overwrite saved plans', async () => {
  const f = await fixture()
  try {
    let calls = 0
    await assert.rejects(
      applyBundle({
        ...f,
        bundle: await bundle(),
        version: '1.2.1',
        rename: async (a, b) => {
          if (++calls === 2) throw Object.assign(Error(), { code: 'EACCES' })
          return fs.rename(a, b)
        },
      }),
      (e) => e.code === 'installFailed',
    )
    assert.equal(await fs.readFile(path.join(f.appRoot, 'dist/index.html'), 'utf8'), 'old UI')
    assert.equal(await fs.readFile(path.join(f.dataDir, 'plans.json'), 'utf8'), 'saved user layouts')
  } finally {
    await fs.rm(f.temp, { recursive: true, force: true })
  }
})
test('symlinked old application trees and backup failures stop before installing', async () => {
  const f = await fixture()
  try {
    await fs.symlink(path.join(f.dataDir, 'plans.json'), path.join(f.appRoot, 'dist/external'))
    await assert.rejects(
      applyBundle({ ...f, bundle: await bundle(), version: '1.2.1' }),
      (e) => e.code === 'unsupportedInstallation',
    )
    assert.equal(await fs.readFile(path.join(f.appRoot, 'dist/index.html'), 'utf8'), 'old UI')
    await fs.rm(path.join(f.appRoot, 'dist/external'))
    await fs.rm(path.join(f.dataDir, 'update-backups'), { recursive: true, force: true })
    await fs.writeFile(path.join(f.dataDir, 'update-backups'), 'blocked')
    await assert.rejects(
      applyBundle({ ...f, bundle: await bundle(), version: '1.2.1' }),
      (e) => e.code === 'backupFailed',
    )
  } finally {
    await fs.rm(f.temp, { recursive: true, force: true })
  }
})
test('startup failure restores previous application and validates its restart without reverting newer user data', async () => {
  const f = await fixture()
  try {
    const job = await applyBundle({ ...f, bundle: await bundle(), version: '1.2.1' })
    await fs.writeFile(path.join(f.dataDir, 'plans.json'), 'newer saved layouts')
    const result = await supervise(job, {
      waitForExit: false,
      timeout: 50,
      launch: () => ({ kill() {} }),
      healthy: async (v) => v === '1.2.0',
    })
    assert.equal(result, false)
    assert.equal(JSON.parse(await fs.readFile(path.join(f.dataDir, 'update-state.json'))).phase, 'rolledBack')
    assert.equal(await fs.readFile(path.join(f.dataDir, 'plans.json'), 'utf8'), 'newer saved layouts')
  } finally {
    await fs.rm(f.temp, { recursive: true, force: true })
  }
})
test('service never installs on checks; requires matching version and session confirmation, and refuses system packages', async () => {
  const f = await fixture()
  try {
    const remote = releaseFixture(await bundle())
    let restarted = 0
    const service = await createUpdateService({
      ...f,
      fetchImpl: remote.fetchImpl,
      onRestart: async () => {
        restarted++
      },
      platform: 'linux',
    })
    const info = await service.info()
    assert.equal(info.canInstall, true)
    await service.check()
    assert.equal(restarted, 0)
    assert.equal(service.state.phase, 'idle')
    await assert.rejects(
      service.install({ version: '1.2.1', confirmationToken: 'wrong' }),
      (e) => e.code === 'confirmationRequired',
    )
    await assert.rejects(
      service.install({ version: '99.0.0', confirmationToken: info.token }),
      (e) => e.code === 'changed',
    )
    await service.install({ version: '1.2.1', confirmationToken: info.token })
    for (let i = 0; i < 300 && restarted === 0 && service.state.phase !== 'failed'; i++)
      await new Promise((r) => setTimeout(r, 20))
    assert.equal(service.state.phase, 'restarting')
    assert.equal(restarted, 1)
    await fs.writeFile(
      path.join(f.appRoot, 'update-installation.json'),
      JSON.stringify({ application: 'carrera-track-planner', distribution: 'deb' }),
    )
    assert.equal((await service.info()).canInstall, false)
  } finally {
    await fs.rm(f.temp, { recursive: true, force: true })
  }
})
test('tampered backup is rejected before altering the currently installed application', async () => {
  const f = await fixture()
  try {
    const job = await applyBundle({ ...f, bundle: await bundle(), version: '1.2.1' })
    await fs.writeFile(path.join(job.backup, 'application/dist/index.html'), 'damaged backup')
    const { restoreBackup } = await import('../addons/track-planner/updater/engine.mjs')
    await assert.rejects(restoreBackup(job), (e) => e.code === 'rollbackFailed')
    assert.equal(JSON.parse(await fs.readFile(path.join(f.appRoot, 'dist/release.json'))).version, '1.2.1')
  } finally {
    await fs.rm(f.temp, { recursive: true, force: true })
  }
})
test('failed restart launch restores the old app and releases the update lock', async () => {
  const f = await fixture()
  try {
    const remote = releaseFixture(await bundle())
    const service = await createUpdateService({
      ...f,
      fetchImpl: remote.fetchImpl,
      onRestart: async () => {
        throw Error('spawn failed')
      },
      platform: 'linux',
    })
    const info = await service.info()
    await service.check()
    await service.install({ version: '1.2.1', confirmationToken: info.token })
    for (let i = 0; i < 300 && service.state.phase !== 'failed'; i++) await new Promise((r) => setTimeout(r, 20))
    assert.equal(service.state.phase, 'failed')
    assert.equal(await fs.readFile(path.join(f.appRoot, 'dist/index.html'), 'utf8'), 'old UI')
    await assert.rejects(fs.access(path.join(f.appRoot, '.planner-update.lock')))
  } finally {
    await fs.rm(f.temp, { recursive: true, force: true })
  }
})
test('a second installation cannot enter the application while its filesystem lock is held', async () => {
  const f = await fixture()
  try {
    const payload = await bundle(),
      first = applyBundle({ ...f, bundle: payload, version: '1.2.1' })
    for (let i = 0; i < 100; i++) {
      try {
        await fs.access(path.join(f.appRoot, '.planner-update.lock'))
        break
      } catch {
        await new Promise((r) => setTimeout(r, 10))
      }
    }
    await assert.rejects(applyBundle({ ...f, bundle: payload, version: '1.2.1' }), (e) => e.code === 'busy')
    await first
  } finally {
    await fs.rm(f.temp, { recursive: true, force: true })
  }
})
test('an abandoned update is reported as interrupted without restarting or overwriting application files', async () => {
  const f = await fixture()
  try {
    await fs.writeFile(
      path.join(f.dataDir, 'update-state.json'),
      JSON.stringify({ phase: 'downloading', version: '1.2.1', ownerPid: -1 }),
    )
    let restarted = 0
    const service = await createUpdateService({
      ...f,
      onRestart: async () => {
        restarted++
      },
    })
    assert.equal((await service.info()).state.phase, 'interrupted')
    assert.equal((await service.info()).state.error, 'interrupted')
    assert.equal(restarted, 0)
    assert.equal(await fs.readFile(path.join(f.appRoot, 'dist/index.html'), 'utf8'), 'old UI')
  } finally {
    await fs.rm(f.temp, { recursive: true, force: true })
  }
})
