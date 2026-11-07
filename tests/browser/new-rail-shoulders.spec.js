import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import { emptyTrackPlan } from '../../vendor/racehubos/shared/src/index.js'
for (const lang of ['de', 'en', 'fr'])
  test(`new rail shoulders, repeat mode and pit catalogue (${lang})`, async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await page.getByTestId('standalone-language').selectOption(lang)
    await page.getByTestId('standalone-new').click()
    await page.getByTestId('room-continue').click()
    await page.getByTestId('lay-borders').check()
    await page.getByTestId('lay-borders-side').selectOption('left')
    await page.getByTestId('add-track-piece').click()
    const svg = page.getByTestId('graph-track-canvas')
    await expect(svg.getByTestId('border-shape-0-left-strip')).toHaveCount(1)
    await expect(svg.getByTestId('border-shape-0-right-strip')).toHaveCount(0)
    await page.getByTestId('repeat-track-part').check()
    await expect(page.getByTestId('lay-borders-side')).toHaveValue('left')
    await page.getByTestId('room-background-visible').uncheck()
    await page.getByTestId('track-fit').click()
    for (let i = 1; i <= 2; i++) {
      const p = await svg.evaluate((svg, x) => {
        const p = svg.createSVGPoint()
        p.x = x
        p.y = 0
        const q = p.matrixTransform(svg.getScreenCTM())
        return { x: q.x, y: q.y }
      }, 345 * i)
      await page.mouse.move(p.x, p.y)
      await expect(page.getByTestId('repeat-track-preview')).toBeVisible()
      await expect(page.getByTestId('repeat-track-preview').getByTestId('border-shape-0-left-strip')).toHaveCount(1)
      await page.mouse.click(p.x, p.y)
      await expect(svg).toHaveAttribute('data-piece-count', String(i + 1))
      await expect(svg.getByTestId(`border-shape-${i}-left-strip`)).toHaveCount(1)
    }
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('lay-borders-side')).toHaveValue('left')
    await page.getByTestId('track-undo').click()
    await expect(svg).toHaveAttribute('data-piece-count', '2')
    await page.getByTestId('track-redo').click()
    await expect(svg.getByTestId('border-shape-2-left-strip')).toHaveCount(1)
    await fs.mkdir(`docs/screenshots/new-rail-shoulders/${lang}`, { recursive: true })
    await page.screenshot({ path: `docs/screenshots/new-rail-shoulders/${lang}/01-repeat-shoulders.png` })
    await page.getByTestId('planner-files-toggle').click()
    await page.getByTestId('track-plan-import').setInputFiles({
      name: 'pit.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          ...emptyTrackPlan(),
          pieces: [{ type: 'Standardgerade', level: 0, jointDegrees: 0 }],
          trackExtras: [
            { kind: 'pitEntry', placement: { xMm: 600, yMm: 400, headingDegrees: 0 }, level: 0, paintOrder: 0 },
          ],
        }),
      ),
    })
    const pit = svg.locator('[data-pit-part-id="extra-0"]')
    await pit.focus()
    await pit.press('Enter')
    await page.getByTestId('catalogue-tab-borders').click()
    await page.screenshot({ path: `docs/screenshots/new-rail-shoulders/${lang}/03-pit-catalogue.png` })
    await page.getByTestId('pit-shoulder-right').click()
    await expect(svg.locator('[data-pit-part-id="extra-1"]')).toHaveCount(1)
    await expect(page.getByTestId('pit-shoulder-right')).toHaveCount(0)
    await page.screenshot({ path: `docs/screenshots/new-rail-shoulders/${lang}/02-pit-shoulder.png` })
    const shoulderPath = svg.locator('[data-pit-part-id="extra-1"]').locator('path').first()
    const before = await shoulderPath.getAttribute('d')
    await page.getByTestId('rotate-pit-component').click()
    await expect(shoulderPath).not.toHaveAttribute('d', before)
    await page.getByTestId('track-undo').click()
    await expect(shoulderPath).toHaveAttribute('d', before)
    expect(errors).toEqual([])
  })
