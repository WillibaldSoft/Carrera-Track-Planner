import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { backendDir, dataDir } from '@addon/source/paths.js'
import { getDatabasePath } from '@racehubos/backend/src/lib/database-url.js'
import { addonsDirectory, readAddonInstallation } from '@addon/source/packages/backend/src/lib/addons.js'
import { runRegressions } from '../tools/update-guard/run.mjs'
import { certificateFile } from '../tools/update-guard/policy.mjs'
import { createAddonUpdateService } from './planner-updater/addon.mjs'

export async function createPlannerUpdatesRouter({ sessionService }) {
  const router = express.Router()
  const host = path.resolve(backendDir, '../..')
  const dist = path.join(host, 'packages/frontend/dist')
  const cert = certificateFile(host)
  const local = (req) =>
    ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) &&
    /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.get('host') ?? '') &&
    (!req.get('origin') || req.get('origin') === `${req.protocol}://${req.get('host')}`) &&
    (!req.get('sec-fetch-site') || ['same-origin', 'none'].includes(req.get('sec-fetch-site')))
  const service = await createAddonUpdateService({
    directory: path.join(addonsDirectory(), 'track-planner'),
    backupDir: path.join(dataDir, 'planner-update-backups'),
    readInstallation: () => readAddonInstallation(),
    assertIdle: () => {
      if (sessionService?.isActive()) throw Object.assign(new Error('End session first'), { code: 'activeSession' })
    },
    beforeInstall: async (backup) => {
      const Database = createRequire(path.join(backendDir, 'package.json'))('better-sqlite3')
      const db = new Database(getDatabasePath(), { readonly: true })
      try {
        await db.backup(path.join(backup, 'racehubos.db'))
      } finally {
        db.close()
      }
      await fs.cp(dist, path.join(backup, 'host-build'), { recursive: true })
      await fs.copyFile(cert, path.join(backup, 'host-approved.json'))
    },
    approve: () => runRegressions(host),
    afterRollback: async (backup) => {
      await fs.rm(dist, { recursive: true, force: true })
      await fs.cp(path.join(backup, 'host-build'), dist, { recursive: true })
      await fs.copyFile(path.join(backup, 'host-approved.json'), cert)
    },
  })
  router.use((req, res, next) => (local(req) ? next() : res.status(403).json({ success: false, error: 'localOnly' })))
  for (const [endpoint, method, action] of [
    ['info', 'get', () => service.info()],
    ['check', 'get', () => service.check()],
    ['install', 'post', (req) => service.install(req.body ?? {})],
  ])
    router[method]('/' + endpoint, async (req, res) => {
      try {
        const result = await action(req)
        res
          .set('Cache-Control', 'no-store')
          .status(endpoint === 'install' ? 202 : 200)
          .json({ success: true, ...result })
      } catch (e) {
        res.status(409).json({ success: false, error: e.code ?? 'network' })
      }
    })
  return router
}
