import { makeUpdateBundle } from './fixtures/updateBundle.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { fileURLToPath,pathToFileURL } from 'node:url'
import { sha256, UPDATE_ASSET } from '../addons/track-planner/updater/release.mjs'
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../addons/track-planner')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function until(read, predicate, timeout = 20000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    try {
      const x = await read()
      if (predicate(x)) return x
    } catch {}
    await sleep(100)
  }
  throw Error('Timed out waiting for test planner')
}
for (const failing of [false, true])
  test(
    failing
      ? 'real failed startup restores the previous portable application and saved data'
      : 'real launcher updates a temporary portable install, restarts into a new PID, preserves data and verifies backup',
    async () => {
      const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'planner-update-process-')),
        app = path.join(temp, 'app'),
        data = path.join(temp, 'data')
      await fs.mkdir(app)
      await fs.mkdir(data)
      let child, newPid
      try {
        const payload = await makeUpdateBundle('1.2.0')
        const set = (name, bytes) => {
          payload.files[name] = { data: Buffer.from(bytes).toString('base64'), sha256: sha256(bytes) }
        }
        for (const name of [
          'launcher.mjs',
          'standalone-server.mjs',
          ...['engine', 'release', 'service', 'restart'].map((n) => 'updater/' + n + '.mjs'),
        ])
          set(name, await fs.readFile(path.join(source, name)))
        for (const [name, entry] of Object.entries(payload.files)) {
          const file = path.join(app, name)
          await fs.mkdir(path.dirname(file), { recursive: true })
          await fs.writeFile(file, Buffer.from(entry.data, 'base64'))
        }
        await fs.writeFile(
          path.join(app, 'update-installation.json'),
          JSON.stringify({ application: 'carrera-track-planner', distribution: 'portable' }),
        )
        const stored = { version: 1, tracks: [], preferences: { testValue: 'preserved' } }
        await fs.writeFile(path.join(data, 'plans.json'), JSON.stringify(stored))
        payload.version = '1.2.1'
        if (failing) set('standalone-server.mjs', "throw new Error('intentional restart failure for isolated test')\n")
        set('dist/release.json', JSON.stringify({ application: 'carrera-track-planner', version: '1.2.1' }))
        const bytes = Buffer.from(JSON.stringify(payload)),
          sum = sha256(bytes),
          prefix = 'https://github.com/WillibaldSoft/Carrera-Track-Planner/releases/download/v1.2.1/'
        const release = {
          tag_name: 'v1.2.1',
          draft: false,
          prerelease: false,
          assets: [
            {
              name: UPDATE_ASSET,
              state: 'uploaded',
              size: bytes.length,
              digest: 'sha256:' + sum,
              browser_download_url: prefix + UPDATE_ASSET,
            },
            { name: 'SHA256SUMS', state: 'uploaded', size: 100, browser_download_url: prefix + 'SHA256SUMS' },
          ],
        }
        await fs.writeFile(path.join(temp, 'payload.json'), bytes)
        await fs.writeFile(path.join(temp, 'release.json'), JSON.stringify(release))
        const preload = path.join(temp, 'network-fixture.mjs')
        await fs.writeFile(
          preload,
          `import fs from 'node:fs/promises';const real=globalThis.fetch;globalThis.fetch=async(url,options)=>{if(String(url).startsWith('http://127.0.0.1'))return real(url,options);if(String(url).endsWith('/latest'))return new Response(await fs.readFile(${JSON.stringify(path.join(temp, 'release.json'))}));if(String(url).endsWith('/SHA256SUMS'))return new Response(${JSON.stringify(sum + '  ' + UPDATE_ASSET + '\n')});return new Response(await fs.readFile(${JSON.stringify(path.join(temp, 'payload.json'))}));};`,
        )
        const socket = net.createServer()
        await new Promise((r) => socket.listen(0, '127.0.0.1', r))
        const port = socket.address().port
        await new Promise((r) => socket.close(r))
        const url = `http://127.0.0.1:${port}`
        child = spawn(process.execPath, ['--import', pathToFileURL(preload).href, path.join(app, 'launcher.mjs')], {
          env: {
            ...process.env,
            PORT: String(port),
            RACEHUBOS_NO_OPEN: '1',
            RACEHUBOS_PLANNER_DATA_DIR: data,
          },
          stdio: 'ignore',
        })
        const read = async (endpoint) => {
          const r = await fetch(url + endpoint, { signal: AbortSignal.timeout(1500) })
          return r.json()
        }
        const old = await until(
          () => read('/api/planner-info'),
          (x) => x.appVersion === '1.2.0',
        )
        assert.equal(old.instancePid, child.pid)
        const info = await read('/api/updates/info')
        assert.equal(info.canInstall, true)
        assert.equal((await read('/api/updates/check')).version, '1.2.1')
        const post = (body) =>
          fetch(url + '/api/updates/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        assert.equal((await post({ version: '1.2.1', confirmationToken: 'not-confirmed' })).status, 409)
        const cross = await fetch(url + '/api/updates/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.invalid' },
          body: '{}',
        })
        assert.equal(cross.status, 403)
        assert.equal((await post({ version: '1.2.1', confirmationToken: info.token })).status, 202)
        const finished = await until(
          () => read('/api/updates/info'),
          (x) => x.state?.phase === (failing ? 'rolledBack' : 'complete'),
          45000,
        )
        assert.equal(finished.current, failing ? '1.2.0' : '1.2.1')
        newPid = finished.state.pid
        assert.ok(newPid && newPid !== old.instancePid)
        assert.equal((await read('/api/planner-info')).instancePid, newPid)
        assert.deepEqual(JSON.parse(await fs.readFile(path.join(data, 'plans.json'))), stored)
        const backup = finished.state.backup
        assert.ok(backup.startsWith(data + path.sep))
        assert.equal(JSON.parse(await fs.readFile(path.join(backup, 'application/dist/release.json'))).version, '1.2.0')
        assert.equal(
          JSON.parse(await fs.readFile(path.join(backup, 'backup-manifest.json')))['plans.json'],
          sha256(JSON.stringify(stored)),
        )
        await until(
          async () => {
            try {
              await fs.access(path.join(app, '.planner-update.lock'))
              return false
            } catch {
              return true
            }
          },
          (x) => x,
        )
      } finally {
        child?.kill()
        if (newPid)
          try {
            process.kill(newPid, 'SIGTERM')
          } catch {}
        // A failed assertion can still leave the supervised test process alive.
        try {
          const state = JSON.parse(await fs.readFile(path.join(data, 'update-state.json')))
          if (state.pid && state.pid !== child?.pid) process.kill(state.pid, 'SIGTERM')
        } catch {}
        await sleep(200)
        await fs.rm(temp, { recursive: true, force: true })
      }
    },
  )
