import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
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
    await fs.writeFile(
      path.join(dir, 'manifest.json'),
      JSON.stringify({ language: lang, syntheticData: true, screenshots: shots }, null, 2) + '\n',
    )
  })
