import { test, expect } from '@playwright/test'
import fs from 'node:fs'
const plan = JSON.parse(fs.readFileSync(new URL('../fixtures/froehlichring-softy-124.json', import.meta.url)))
for (const language of ['de', 'en', 'fr']) {
  test(`printed pit legend counts two entries and exits without duplicate carriers (${language})`, async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('standalone-language').selectOption(language)
    await page.getByTestId('standalone-new').click()
    await page.getByTestId('room-continue').click()
    await page.getByTestId('planner-nav-files').click()
    await page
      .getByTestId('track-plan-import')
      .setInputFiles({ name: 'pitlane.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(plan)) })
    await page.getByTestId('planner-nav-print').click()
    await page.getByTestId('print-include-legend').check()
    const legend = page.getByTestId('track-type-legend')
    await expect(legend.getByTestId('pit-legend-entry')).toContainText('30356 × 2')
    await expect(legend.getByTestId('pit-legend-exit')).toContainText('30356 × 2')
    const rows = await legend.locator('li').allTextContents()
    expect(
      rows.filter((text) => /Pitlane-Einfahrt|Pitlane-Ausfahrt|Pit entry|Pit exit/.test(text) && /× 1/.test(text)),
    ).toEqual([])
    await expect(page.getByTestId('print-material-30356').locator('td').last()).toHaveText('2')
    await expect(page.getByTestId('print-material-30356')).toContainText(
      { de: '2 Einfahrten + 2 Ausfahrten', en: '2 entries + 2 exits', fr: '2 entrées + 2 sorties' }[language],
    )
  })
}
