import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { emptyTrackPlan } from '../../vendor/racehubos/shared/src/index.js'
for (const lang of ['de', 'en', 'fr'])
  test(`CU and fuel appearance (${lang})`, async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('standalone-language').selectOption(lang)
    await page.getByTestId('standalone-new').click()
    await page.getByTestId('room-continue').click()
    await page.getByTestId('start-pit-create').click()
    await page.getByTestId('room-background-visible').uncheck()
    await page.getByTestId('track-view-options').locator('summary').click()
    await page.getByTestId('show-connections').uncheck()
    await page.getByTestId('track-view-options').locator('summary').click()
    await page.getByTestId('graph-track-canvas').click({ position: { x: 20, y: 20 } })
    const canvas = page.getByTestId('graph-track-canvas'),
      dir = path.resolve('docs/screenshots/unit-appearance', lang)
    await fs.mkdir(dir, { recursive: true })
    const shots = []
    async function shot(id, view) {
      await canvas.evaluate((svg, view) => svg.setAttribute('viewBox', view), view)
      const file = id + '.png',
        data = await canvas.screenshot({ path: path.join(dir, file) })
      shots.push({ id, file, sha256: createHash('sha256').update(data).digest('hex') })
    }
    await expect(canvas.locator('[data-testid="cu-housing-detail"]')).toHaveCount(1)
    await shot('01-cu-start-finish', '650 -270 450 480')
    await shot('02-two-fuel-rails', '990 80 430 270')
    await shot('03-cu-and-pit-overview', '550 -280 970 690')
    await page.getByTestId('planner-files-toggle').click()
    const types = [
      'DigitaleDoppelweiche_1',
      'Weiche_links_1',
      'Weiche_rechts_1',
      'Kurvenweiche_links_ai_1',
      'Kurvenweiche_links_ia_1',
      'Kurvenweiche_rechts_ai_1',
      'Kurvenweiche_rechts_ia_1',
    ]
    const switches = {
      ...emptyTrackPlan(),
      freePlacement: true,
      pieces: types.map((type, i) => ({
        type,
        level: 0,
        jointDegrees: 0,
        placement: { xMm: 150 + (i % 2) * 800, yMm: 150 + Math.floor(i / 2) * 330, headingDegrees: i % 2 ? 180 : 0 },
      })),
    }
    await page
      .getByTestId('track-plan-import')
      .setInputFiles({
        name: 'switch-diodes.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(switches)),
      })
    await page.getByTestId('track-fit').click()
    await expect(canvas.getByTestId('switch-infrared-sensor')).toHaveCount(8)
    await shot('04-switch-diodes-left', '0 0 1100 1350')
    await fs.writeFile(
      path.join(dir, 'manifest.json'),
      JSON.stringify({ language: lang, syntheticData: true, screenshots: shots }, null, 2) + '\n',
    )
  })
