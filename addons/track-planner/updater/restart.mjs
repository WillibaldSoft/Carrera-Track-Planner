// This supervisor runs from the preserved backup, so a broken new server cannot
// prevent restoring the previous application. Runtime and user plans stay put.
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { restoreBackup } from './engine.mjs'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
export async function supervise(job, { launch, healthy, waitForExit = true, timeout = 15000 } = {}) {
  const stateFile = path.join(job.dataDir, 'update-state.json')
  const write = async (state) => {
    const temp = stateFile + '.tmp'
    await fs.writeFile(temp, JSON.stringify({ ...state, backup: job.backup }, null, 2))
    await fs.rename(temp, stateFile)
  }
  if (waitForExit) {
    for (let i = 0; i < 100; i++) {
      try {
        process.kill(job.oldPid, 0)
      } catch {
        break
      }
      await sleep(100)
    }
  }
  const start =
    launch ??
    (() => {
      const child = spawn(process.execPath, [path.join(job.appRoot, 'launcher.mjs')], {
        env: {
          ...process.env,
          PORT: String(job.port),
          RACEHUBOS_PLANNER_DATA_DIR: job.dataDir,
          RACEHUBOS_NO_OPEN: '1',
        },
        detached: true,
        stdio: 'ignore',
      })
      child.on('error', () => {})
      child.unref()
      return child
    })
  let expectedPid
  const check =
    healthy ??
    (async (version) => {
      try {
        const r = await fetch(`http://127.0.0.1:${job.port}/api/planner-info`, { signal: AbortSignal.timeout(1000) })
        const info = await r.json()
        return (
          info.application === 'racehubos-track-planner' &&
          info.appVersion === version &&
          info.instancePid === expectedPid
        )
      } catch {
        return false
      }
    })
  const child = start()
  expectedPid = child.pid
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await check(job.version)) {
      await write({ phase: 'complete', version: job.version, pid: expectedPid })
      await fs.rm(path.join(job.appRoot, '.planner-update.lock'), { force: true })
      return true
    }
    await sleep(250)
  }
  try {
    child.kill()
  } catch {}
  await sleep(300)
  try {
    await restoreBackup(job)
    const old = JSON.parse(await fs.readFile(path.join(job.appRoot, 'dist/release.json'), 'utf8')).version
    expectedPid = start().pid
    const until = Date.now() + timeout
    while (Date.now() < until) {
      if (await check(old)) {
        await write({ phase: 'rolledBack', version: old, error: 'startupFailed', pid: expectedPid })
        await fs.rm(path.join(job.appRoot, '.planner-update.lock'), { force: true })
        return false
      }
      await sleep(250)
    }
    throw Error('rollback startup failed')
  } catch {
    await write({ phase: 'failed', error: 'rollbackFailed' })
    return false
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const job = JSON.parse(await fs.readFile(process.argv.at(-1), 'utf8'))
  if (process.argv.includes('--restore')) {
    await restoreBackup(job)
    await fs.rm(path.join(job.appRoot, '.planner-update.lock'), { force: true })
    console.log('Application restored; saved plans unchanged.')
  } else await supervise(job)
}
