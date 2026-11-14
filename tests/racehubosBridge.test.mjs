import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { installRaceHubOSBridge, registerPlannerUpdates } from '../integrations/racehubos-1.32/install.mjs'
const original =
  "import express from 'express';\nexport async function register(ctx) {\n  ctx.app.use('/api/addons', legacyAddons);\n}\n"
test('bridge registration is idempotent and refuses unknown/incomplete host registrations', () => {
  const patched = registerPlannerUpdates(original)
  assert.equal(registerPlannerUpdates(patched), patched)
  assert.equal(patched.split("ctx.app.use('/api/addons/track-planner/updates'").length, 2)
  assert.throws(() => registerPlannerUpdates('unknown server'))
  assert.throws(() =>
    registerPlannerUpdates(original + "import {createPlannerUpdatesRouter} from './planner-updates.js';"),
  )
})
for (const fail of [false, true])
  test(
    'bridge installer ' +
      (fail
        ? 'restores the prior host after failed checks'
        : 'packages both host service and planner without changing core or saved plans'),
    async () => {
      const host = await fs.mkdtemp(path.join(os.tmpdir(), 'planner-bridge-test-'))
      try {
        const addon = path.join(host, 'addons/carrera-local')
        for (const name of ['server', 'legacy-addons/track-planner'])
          await fs.mkdir(path.join(addon, name), { recursive: true })
        await fs.mkdir(path.join(host, 'packages/frontend/dist'), { recursive: true })
        await fs.mkdir(path.join(host, 'addons/.data/carrera-local/update-checks'), { recursive: true })
        const pkg = JSON.stringify({ version: '1.32.0' })
        await fs.writeFile(path.join(host, 'package.json'), pkg)
        await fs.writeFile(path.join(addon, 'racehubos-addon.json'), JSON.stringify({ id: 'carrera-local' }))
        await fs.writeFile(path.join(addon, 'server/index.js'), original)
        await fs.writeFile(path.join(addon, 'legacy-addons/track-planner/index.html'), 'old planner')
        await fs.writeFile(path.join(host, 'packages/frontend/dist/index.html'), 'old host build')
        await fs.writeFile(path.join(host, 'addons/.data/carrera-local/update-checks/approved.json'), 'old approval')
        await fs.writeFile(path.join(host, 'plans.json'), 'saved Fröhlichring')
        let checked = false
        const run = () =>
          installRaceHubOSBridge({
            host,
            snapshotDatabase: async (target) => fs.copyFile(path.join(host, 'plans.json'), target),
            approve: async () => {
              checked = true
              if (fail) throw Error('intentional host check failure')
            },
          })
        if (fail) {
          await assert.rejects(run(), /intentional host check failure/)
          assert.equal(await fs.readFile(path.join(addon, 'server/index.js'), 'utf8'), original)
          assert.equal(
            await fs.readFile(path.join(addon, 'legacy-addons/track-planner/index.html'), 'utf8'),
            'old planner',
          )
        } else {
          const result = await run()
          assert.equal(result.compatibilityChecks, 'passed')
          assert.ok((await fs.readFile(path.join(addon, 'server/index.js'), 'utf8')).includes('/updates'))
          await fs.access(path.join(addon, 'server/planner-updater/addon.mjs'))
          assert.equal(await fs.readFile(path.join(result.backup, 'racehubos.db'), 'utf8'), 'saved Fröhlichring')
        }
        assert.equal(checked, true)
        assert.equal(await fs.readFile(path.join(host, 'package.json'), 'utf8'), pkg)
        assert.equal(await fs.readFile(path.join(host, 'plans.json'), 'utf8'), 'saved Fröhlichring')
        assert.equal(await fs.readFile(path.join(host, 'packages/frontend/dist/index.html'), 'utf8'), 'old host build')
      } finally {
        await fs.rm(host, { recursive: true, force: true })
      }
    },
  )
