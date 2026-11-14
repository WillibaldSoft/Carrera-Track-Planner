import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createAddonUpdateService, validateAddonBundle, addonRelease } from '../addons/track-planner/updater/addon.mjs'
import { sha256 } from '../addons/track-planner/updater/release.mjs'
const payload = (version) => {
  const bytes = Buffer.from('<html>' + version + '</html>')
  return {
    manifest: {
      id: 'track-planner',
      hostApi: 1,
      entry: 'index.html',
      version,
      license: 'AGPL-3.0-only',
      files: { 'index.html': sha256(bytes) },
    },
    files: { 'index.html': bytes.toString('base64') },
  }
}
async function fixture({ failApproval = false, tamper = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'planner-addon-update-')),
    directory = path.join(root, 'addons/track-planner'),
    backupDir = path.join(root, 'data/backups')
  await fs.mkdir(directory, { recursive: true })
  const old = payload('1.3.0')
  await fs.writeFile(path.join(directory, 'index.html'), Buffer.from(old.files['index.html'], 'base64'))
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(old.manifest))
  await fs.mkdir(path.join(root, 'data'), { recursive: true })
  await fs.writeFile(path.join(root, 'data/plans'), 'Fröhlichring: 15% / 15%')
  const bytes = Buffer.from(JSON.stringify(payload('1.3.1'))),
    prefix = 'https://github.com/WillibaldSoft/Carrera-Track-Planner/releases/download/v1.3.1/'
  const release = {
    tag_name: 'v1.3.1',
    draft: false,
    prerelease: false,
    assets: [
      {
        name: 'track-planner.racehub-addon.json',
        state: 'uploaded',
        size: bytes.length,
        digest: 'sha256:' + sha256(bytes),
        browser_download_url: prefix + 'track-planner.racehub-addon.json',
      },
      { name: 'SHA256SUMS', state: 'uploaded', browser_download_url: prefix + 'SHA256SUMS' },
    ],
  }
  let approvals = 0,
    backups = 0
  const readInstallation = async () => {
    const m = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json')))
    const valid = sha256(await fs.readFile(path.join(directory, 'index.html'))) === m.files['index.html']
    return { version: m.version, compatible: valid }
  }
  const service = await createAddonUpdateService({
    directory,
    backupDir,
    readInstallation,
    fetchImpl: async (url) =>
      new Response(
        url.endsWith('/latest')
          ? JSON.stringify(release)
          : url.endsWith('/SHA256SUMS')
            ? sha256(bytes) + '  track-planner.racehub-addon.json\n'
            : tamper
              ? Buffer.from('tampered')
              : bytes,
      ),
    beforeInstall: async (backup) => {
      backups++
      await fs.copyFile(path.join(root, 'data/plans'), path.join(backup, 'plans'))
    },
    approve: async () => {
      approvals++
      if (failApproval) throw Error('Regression failed')
    },
  })
  return { root, directory, backupDir, service, release, readInstallation, stats: () => ({ approvals, backups }) }
}
async function finished(service) {
  for (let i = 0; i < 200 && service.busy; i++) await new Promise((r) => setTimeout(r, 10))
  assert.equal(service.busy, false)
}
test('official addon installs in place with backup, host checks and unchanged saved plans', async () => {
  const f = await fixture()
  try {
    const info = await f.service.info()
    assert.equal(info.canInstall, true)
    assert.equal((await f.service.check()).installable, true)
    await assert.rejects(
      f.service.install({ version: '1.3.1', confirmationToken: 'wrong' }),
      (e) => e.code === 'confirmationRequired',
    )
    await f.service.install({ version: '1.3.1', confirmationToken: info.token })
    await finished(f.service)
    assert.equal(f.service.state.phase, 'complete')
    assert.equal((await f.readInstallation()).version, '1.3.1')
    assert.deepEqual(f.stats(), { approvals: 1, backups: 1 })
    assert.equal(await fs.readFile(path.join(f.root, 'data/plans'), 'utf8'), 'Fröhlichring: 15% / 15%')
    assert.equal(await fs.readFile(path.join(f.service.state.backup, 'plans'), 'utf8'), 'Fröhlichring: 15% / 15%')
  } finally {
    await fs.rm(f.root, { recursive: true, force: true })
  }
})
for (const options of [{ failApproval: true }, { tamper: true }])
  test('failed approval or checksum restores/retains existing addon ' + JSON.stringify(options), async () => {
    const f = await fixture(options)
    try {
      const info = await f.service.info()
      await f.service.check()
      await f.service.install({ version: '1.3.1', confirmationToken: info.token })
      await finished(f.service)
      assert.equal(f.service.state.phase, 'failed')
      assert.equal((await f.readInstallation()).version, '1.3.0')
      assert.equal(await fs.readFile(path.join(f.root, 'data/plans'), 'utf8'), 'Fröhlichring: 15% / 15%')
    } finally {
      await fs.rm(f.root, { recursive: true, force: true })
    }
  })
test('addon validation rejects path traversal and release URLs outside the official repository', async () => {
  const b = payload('1.3.1')
  b.manifest.files['../escape'] = 'a'.repeat(64)
  b.files['../escape'] = 'YQ=='
  assert.throws(() => validateAddonBundle(b, '1.3.1'))
  const f = await fixture()
  try {
    f.release.assets[0].browser_download_url = 'https://untrusted.invalid/addon.json'
    assert.equal(addonRelease(f.release, '1.3.0').installable, false)
  } finally {
    await fs.rm(f.root, { recursive: true, force: true })
  }
})
