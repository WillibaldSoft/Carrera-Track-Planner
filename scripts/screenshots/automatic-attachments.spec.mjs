import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
for (const lang of ['de', 'en', 'fr'])
  test(`automatic accessories and central toolbar (${lang})`, async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('standalone-language').selectOption(lang)
    await page.getByTestId('standalone-new').click()
    await page.getByTestId('room-continue').click()
    await page
      .locator('.planner-name')
      .fill(
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
    await fs.writeFile(
      path.join(dir, 'manifest.json'),
      JSON.stringify({ language: lang, syntheticData: true, screenshots: shots }, null, 2) + '\n',
    )
  })
