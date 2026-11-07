import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { emptyTrackPlan } from '../../vendor/racehubos/shared/src/trackPlan.js'
const plan = {
  ...emptyTrackPlan(),
  pieces: Array.from({ length: 6 }, (_, i) => ({
    type: 'Standardgerade',
    level: 0,
    jointDegrees: 0,
    ...(i === 0
      ? { elevation: { heightMm: 0, flat: false } }
      : i === 3
        ? { elevation: { heightMm: 160, flat: true } }
        : i === 5
          ? { elevation: { heightMm: 0, flat: true } }
          : {}),
  })),
}
for (const lang of ['de', 'en', 'fr'])
  test(`2D heights and gradients screenshots (${lang})`, async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('standalone-language').selectOption(lang)
    await page.getByTestId('standalone-new').click()
    await page.getByTestId('room-continue').click()
    await page.getByTestId('planner-files-toggle').click()
    await page.getByTestId('track-plan-import').setInputFiles({
      name: 'heights-demo.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(plan)),
    })
    await page
      .locator('.planner-name')
      .fill({ de: 'Höhen und Steigungen · 2D', en: 'Heights and gradients · 2D', fr: 'Hauteurs et pentes · 2D' }[lang])
    await page.getByTestId('planner-mode').selectOption('editor')
    await page.getByTestId('show-track-elevations').check()
    const dir = path.resolve('docs/screenshots/height-labels', lang),
      shots = []
    await fs.mkdir(dir, { recursive: true })
    async function shot(id) {
      const file = id + '.png',
        data = await page.screenshot({ path: path.join(dir, file) })
      shots.push({ id, file, sha256: createHash('sha256').update(data).digest('hex') })
    }
    await page.locator('[data-testid="track-height-label"][data-height-rail="3"]').click()
    await page.getByTestId('graph-track-canvas').focus()
    await page.getByTestId('graph-track-canvas').press('f')
    await shot('01-heights-on-rails')
    await page.getByTestId('track-fit').click()
    await page.locator('[data-testid="track-height-label"][data-height-rail="0"]').click()
    await page.getByTestId('two-slope-target').selectOption('3')
    await page.getByTestId('two-slope-percent').fill('10')
    await page.getByTestId('two-apply-slope').click()
    await expect(page.locator('[data-testid="track-height-label"][data-height-rail="3"]')).toContainText('103.5')
    await page.getByTestId('two-apply-slope').scrollIntoViewIfNeeded()
    await shot('02-edit-height-and-gradient')
    await page.getByTestId('show-track-elevations').uncheck()
    await expect(page.getByTestId('track-height-label')).toHaveCount(0)
    await shot('03-values-hidden')
    await page.getByTestId('planner-files-toggle').click()
    await page.getByTestId('track-plan-import').setInputFiles({
      name: 'bridge-demo.json',
      mimeType: 'application/json',
      buffer: await fs.readFile(
        new URL('../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url),
      ),
    })
    await page.getByTestId('planner-mode').selectOption('editor')
    await page
      .locator('.planner-name')
      .fill({ de: 'Durchfahrtshöhe · 2D', en: 'Bridge clearance · 2D', fr: 'Passage libre · 2D' }[lang])
    await page.getByTestId('show-track-elevations').check()
    const upper = page.locator('[data-testid="track-height-label"][data-height-rail="33"]')
    await upper.focus()
    await upper.press('Enter')
    await page.getByTestId('two-local-clearance').fill('200')
    await page.getByTestId('graph-track-canvas').focus()
    await page.getByTestId('graph-track-canvas').press('f')
    await shot('04-edit-bridge-clearance')
    await page.getByTestId('track-fit').click()
    await shot('05-overview-label-spacing')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByTestId('track-fit').click()
    await shot('06-mobile-label-density')
    await page.setViewportSize({ width: 1600, height: 1400 })
    await page.getByTestId('planner-files-toggle').click()
    await page.getByTestId('track-plan-import').setInputFiles({
      name: 'manual-labels.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(plan)),
    })
    await page.getByTestId('planner-mode').selectOption('editor')
    await page
      .locator('.planner-name')
      .fill({ de: 'Beschriftungen verschieben · 2D', en: 'Move labels · 2D', fr: 'Déplacer les étiquettes · 2D' }[lang])
    await page.getByTestId('show-track-elevations').check()
    await page.getByTestId('track-fit').click()
    const manual = page.locator('[data-testid="track-height-label"][data-height-rail="3"]'),
      b = await manual.boundingBox()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2 + 70, b.y + b.height / 2 - 90, { steps: 8 })
    await page.mouse.up()
    await expect(manual).toHaveAttribute('data-label-manual', 'true')
    await manual.click()
    await shot('07-manual-label-position')
    await page.getByTestId('arrange-height-labels').click()
    await expect(manual).toHaveAttribute('data-label-manual', 'false')
    await shot('08-automatic-label-reset')
    await page.getByTestId('track-undo').click()
    await expect(manual).toHaveAttribute('data-label-manual', 'true')
    await page.getByTestId('track-print-preview').click()
    await expect(page.getByTestId('track-print-view')).toHaveValue('current')
    await page.getByTestId('track-print-snapshot').evaluate((img) => img.decode())
    await shot('09-current-view-print-pdf')

    await fs.writeFile(
      path.join(dir, 'manifest.json'),
      JSON.stringify({ language: lang, syntheticData: true, screenshots: shots }, null, 2) + '\n',
    )
  })
