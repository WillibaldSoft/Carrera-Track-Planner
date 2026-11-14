import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

for (const language of ['de', 'en', 'fr']) {
  test(`1.5.1 sensor markings (${language})`, async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('standalone-language').selectOption(language)
    await page.getByTestId('standalone-new').click()
    await page.getByTestId('room-continue').click()
    await page.getByTestId('start-pit-create').click()
    const canvas = page.getByTestId('graph-track-canvas')
    const cu = canvas.locator('[data-unit-kind="Control_unit"]')
    await expect(cu.locator('[data-testid^="cu-track-sensor-"]')).toHaveCount(2)
    await expect(cu.locator('[data-testid^="cu-track-sensor-"]').first()).toHaveAttribute(
      'transform',
      'translate(-105 0)',
    )
    await expect(cu.getByTestId('cu-start-finish-markings').locator('rect[x="150"]')).toHaveCount(1)
    await expect(canvas.locator('[data-fuel-artwork]')).toHaveCount(2)
    const dir = path.resolve('docs/screenshots/v1.5.1', language)
    await fs.mkdir(dir, { recursive: true })
    await page.getByTestId('room-background-visible').uncheck()
    await canvas.click({ position: { x: 20, y: 20 } })
    await page.getByTestId('track-fit').click()
    await page.screenshot({ path: path.join(dir, 'sensor-markings.jpg'), fullPage: false })
    await page.getByTestId('planner-nav-print').click()
    await page.getByTestId('print-include-drawing').uncheck()
    await page.getByTestId('print-include-legend').check()
    await expect(page.getByTestId('pit-legend-entry')).toContainText('30356 × 2')
    await expect(page.getByTestId('pit-legend-exit')).toContainText('30356 × 2')
    await expect(page.getByTestId('print-material-30356').locator('td').last()).toHaveText('2')
    await page.screenshot({ path: path.join(dir, 'pitlane-print.jpg'), fullPage: true })
  })
}
