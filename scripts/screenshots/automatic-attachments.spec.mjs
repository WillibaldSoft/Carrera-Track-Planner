import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { emptyTrackPlan } from '../../vendor/racehubos/shared/src/index.js'
for (const lang of ['de', 'en', 'fr'])
  test(`automatic accessories and central toolbar (${lang})`, async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('standalone-language').selectOption(lang)
    await page.getByTestId('standalone-new').click()
    await page.getByTestId('room-continue').click()
    await page.locator('.planner-name').fill(
      {
        de: 'Anbauteile und Werkzeugleiste · Demo',
        en: 'Accessories and toolbar · Demo',
        fr: 'Accessoires et barre d’outils · Démo',
      }[lang],
    )
    for (let i = 0; i < 3; i++) await page.getByTestId('add-track-piece').click()
    await page.getByTestId('palette-Kurve_1_60_rechts').click()
    await page.getByTestId('room-background-visible').uncheck()
    await page.getByTestId('track-view-options').locator('summary').click()
    await page.getByTestId('show-connections').uncheck()
    await page.getByTestId('track-view-options').locator('summary').click()
    const canvas = page.getByTestId('graph-track-canvas')
    await canvas.click({ position: { x: 20, y: 20 } })
    await page.getByTestId('track-fit').click()
    await page.getByTestId('track-auto-attachments').click()
    async function hoverRail() {
      const p = await canvas
        .getByTestId('rail-2')
        .locator('[data-rail-slots] path')
        .first()
        .evaluate((path) => {
          const p = path.getPointAtLength(path.getTotalLength() / 2),
            q = new DOMPoint(p.x, p.y + 15).matrixTransform(path.getScreenCTM())
          return { x: q.x, y: q.y }
        })
      await page.mouse.move(p.x, p.y)
      await expect(page.getByTestId('automatic-attachments')).toBeVisible()
    }
    const dir = path.resolve('docs/screenshots/automatic-attachments', lang),
      shots = []
    await fs.mkdir(dir, { recursive: true })
    async function shot(id) {
      const file = id + '.png',
        data = await page.screenshot({ path: path.join(dir, file) })
      shots.push({ id, file, sha256: createHash('sha256').update(data).digest('hex') })
    }
    await hoverRail()
    await shot('01-hover-and-toolbar')
    await page.getByTestId('auto-attach-left').hover()
    await expect(page.getByTestId('automatic-attachment-preview')).toBeVisible()
    await shot('02-accessory-preview')
    await page.getByTestId('auto-attach-left').click()
    await hoverRail()
    await page.getByTestId('auto-attach-left-startCap').click()
    const rail = canvas.getByTestId('rail-2')
    await rail.focus()
    await rail.press('Enter')
    await page.getByTestId('track-center-selection').click()
    await shot('03-centred-selection')
    await page.getByTestId('track-auto-attachments').click()
    await page.getByTestId('planner-files-toggle').click()
    const types = ['Standardgerade', 'Kurve_1_60_rechts', 'Kurve_2_30_links', 'Kurve_3_30_rechts']
    const source = {
      ...emptyTrackPlan(),
      freePlacement: true,
      pieces: types.map((type, i) => ({
        type,
        level: 0,
        jointDegrees: 0,
        placement: { xMm: 200 + (i % 2) * 1050, yMm: 150 + Math.floor(i / 2) * 900, headingDegrees: 0 },
        borders: { left: { startCap: i === 0, endCap: false }, right: { startCap: i === 0, endCap: false } },
      })),
    }
    await page.getByTestId('track-auto-attachments').evaluate((button) => {
      if (button.getAttribute('aria-pressed') === 'true') button.click()
    })
    await page
      .getByTestId('track-plan-import')
      .setInputFiles({
        name: 'individual-shoulders.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(source)),
      })
    await page.getByTestId('planner-mode').selectOption('editor')
    await page.getByTestId('track-fit').click()
    await canvas.evaluate((svg) => svg.setAttribute('viewBox', '-50 -100 2100 1850'))
    const file = '04-piece-specific-curve-colours.png'
    const data = await canvas.screenshot({ path: path.join(dir, file) })
    shots.push({ id: '04-piece-specific-curve-colours', file, sha256: createHash('sha256').update(data).digest('hex') })
    await fs.writeFile(
      path.join(dir, 'manifest.json'),
      JSON.stringify({ language: lang, syntheticData: true, screenshots: shots }, null, 2) + '\n',
    )
  })
