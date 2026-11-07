import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { DEFAULT_ROOM } from '../../vendor/racehubos/shared/src/index.js'
const source = JSON.parse(
  await fs.readFile(new URL('../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url)),
)
for (const lang of ['de', 'en', 'fr'])
  test(`3D room screenshots (${lang})`, async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('standalone-language').selectOption(lang)
    await page.getByTestId('standalone-new').click()
    await page.getByTestId('room-continue').click()
    await page.getByTestId('planner-files-toggle').click()
    await page.getByTestId('track-plan-import').setInputFiles({
      name: '3d-demo.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          ...source,
          roomPlan: {
            ...DEFAULT_ROOM,
            features: [
              {
                id: 'k',
                name: { de: 'Kamin', en: 'Chimney', fr: 'Cheminée' }[lang],
                kind: 'obstacle',
                xM: 0,
                yM: 0,
                widthM: 0.8,
                depthM: 0.6,
              },
              {
                id: 'n',
                name: { de: 'Nische', en: 'Alcove', fr: 'Renfoncement' }[lang],
                kind: 'extension',
                xM: 6,
                yM: 1,
                widthM: 1,
                depthM: 2,
              },
            ],
          },
        }),
      ),
    })
    await page
      .locator('.planner-name')
      .fill({ de: 'Bahn im Raum · 3D', en: 'Track in room · 3D', fr: 'Piste dans la pièce · 3D' }[lang])
    await page.getByTestId('toolbar-open-3d').click()
    await expect(page.getByTestId('room-3d-canvas')).toBeVisible()
    const dir = path.resolve('docs/screenshots/room-3d', lang),
      shots = []
    await fs.mkdir(dir, { recursive: true })
    async function shot(id) {
      const file = id + '.png',
        data = await page.screenshot({ path: path.join(dir, file) })
      shots.push({ id, file, sha256: createHash('sha256').update(data).digest('hex') })
    }
    await page.getByTestId('three-display-settings').locator('summary').click()
    await page.getByTestId('three-enable-ramps').click()
    await page.getByTestId('three-display-settings').locator('summary').click()
    await shot('01-room-and-track')
    await page.getByTestId('three-display-settings').locator('summary').click()
    await page.getByTestId('three-walls').uncheck()
    await page.getByTestId('three-display-settings').locator('summary').click()
    await page.getByTestId('room-3d-canvas').focus()
    for (let i = 0; i < 5; i++) await page.getByTestId('room-3d-canvas').press('ArrowDown')
    await shot('02-crossing-clearance')
    await page.getByTestId('three-top').click()
    await shot('03-top-view')
    await page.getByTestId('three-ramp-gradients').locator('summary').click()
    await page.getByTestId('three-display-settings').locator('summary').click()
    await shot('04-ramp-lengths-and-gradients')
    for (const [rail, height, flat] of [
      [26, '0', false],
      [33, '210', true],
      [36, '310', true],
      [44, '0', true],
    ]) {
      await page.getByTestId('three-height-rail').selectOption(String(rail))
      await page.getByTestId('three-rail-height').fill(height)
      await page.getByTestId('three-rail-flat').setChecked(flat)
      await page.getByTestId('three-set-height').click()
    }
    await page.getByTestId('three-height-rail').selectOption('36')
    await page.getByTestId('three-display-settings').locator('summary').click()
    await page.getByTestId('three-reset').click()
    await page.getByTestId('three-display-settings').locator('summary').click()
    await page.getByTestId('three-local-clearance').scrollIntoViewIfNeeded()
    await shot('05-individual-heights')
    await fs.writeFile(
      path.join(dir, 'manifest.json'),
      JSON.stringify({ language: lang, syntheticData: true, screenshots: shots }, null, 2) + '\n',
    )
  })
