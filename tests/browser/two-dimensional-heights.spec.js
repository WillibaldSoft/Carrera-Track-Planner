import { test, expect } from '@playwright/test'
import { emptyTrackPlan } from '../../vendor/racehubos/shared/src/trackPlan.js'
const source = {
  ...emptyTrackPlan(),
  pieces: Array.from({ length: 6 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
}
async function open(page, lang = 'de') {
  await page.goto('/')
  await page.getByTestId('standalone-language').selectOption(lang)
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('planner-nav-files').click()
  await page.getByTestId('track-plan-import').setInputFiles({
    name: '2d-heights.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(source)),
  })
  await page.locator('.planner-name').fill('2D heights ' + lang)
  await page.getByTestId('planner-nav-editor').click()
}
for (const lang of ['de', 'en', 'fr'])
  test(`2D values toggle, edit heights and gradients, save and agree with 3D (${lang})`, async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await open(page, lang)
    await expect(page.getByTestId('track-height-label')).toHaveCount(0)
    await page.getByTestId('show-track-elevations').check()
    const labels = page.getByTestId('track-height-label')
    await expect(labels).toHaveCount(6)
    await page.locator('[data-testid="track-height-label"][data-height-rail="0"]').click()
    await expect(page.getByTestId('two-height-editor')).toHaveAttribute('open', '')
    await page.getByTestId('two-slope-target').selectOption('3')
    await page.getByTestId('two-slope-percent').fill('10')
    await page.getByTestId('two-apply-slope').click()
    const last = page.locator('[data-testid="track-height-label"][data-height-rail="3"]')
    await expect(last).toContainText('103.5')
    await page.getByTestId('track-undo').click()
    await expect(last).toContainText('H 0 mm')
    await page.getByTestId('track-redo').click()
    await expect(last).toContainText('103.5')
    await last.click()
    await page.getByTestId('two-rail-height').fill('200')
    await expect(last).toContainText('200')
    await page.getByTestId('show-track-elevations').uncheck()
    await expect(labels).toHaveCount(0)
    const saved = page.waitForResponse((r) => r.url().endsWith('/api/tracks') && r.request().method() === 'POST')
    await page.getByTestId('planner-save').click()
    const row = (await (await saved).json()).data
    const plan = JSON.parse(row.layout)
    expect(plan.showElevationLabels).toBe(false)
    expect(plan.pieces[3].elevation).toEqual({ heightMm: 200, flat: true })
    expect(plan.pieces.map((p) => p.type)).toEqual(source.pieces.map((p) => p.type))
    await page.reload()
    await page.getByTestId('standalone-track').selectOption(row.id)
    await expect(page.getByTestId('show-track-elevations')).not.toBeChecked()
    await expect(labels).toHaveCount(0)
    await page.getByTestId('show-track-elevations').check()
    await expect(last).toContainText('200')
    await page.getByTestId('planner-nav-3d').click()
    await page.getByTestId('three-display-settings').locator('summary').click()
    await page.getByTestId('three-height-rail').selectOption('3')
    await expect(page.getByTestId('three-rail-height')).toHaveValue('200')
    await page.getByTestId('three-rail-height').fill('300')
    await page.getByTestId('three-back-editor').click()
    await expect(last).toContainText('300')
    expect(errors).toEqual([])
  })
test('2D height controls keep a usable mobile canvas and reject impossible target heights', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await page.getByTestId('show-track-elevations').check()
  await page.locator('[data-testid="track-height-label"][data-height-rail="0"]').click()
  await page.getByTestId('two-slope-target').selectOption('3')
  await page.getByTestId('two-slope-percent').fill('-10')
  await page.getByTestId('two-apply-slope').click()
  await expect(page.getByTestId('two-height-error')).toBeVisible()
  await expect(page.locator('[data-testid="track-height-label"][data-height-rail="3"]')).toContainText('H 0 mm')
  const box = await page.getByTestId('graph-track-canvas').boundingBox()
  expect(box.height).toBeGreaterThan(100)
  expect(box.width).toBeLessThanOrEqual(390)
})

test('2D edits and labels show each bridge clear height', async ({ page }) => {
  const fs = await import('node:fs')
  const bridge = fs.readFileSync(
    new URL('../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url),
  )
  await open(page)
  await page.getByTestId('planner-nav-files').click()
  await page
    .getByTestId('track-plan-import')
    .setInputFiles({ name: 'bridge.json', mimeType: 'application/json', buffer: bridge })
  await page.getByTestId('planner-nav-editor').click()
  await page.getByTestId('show-track-elevations').check()
  const upper = page.locator('[data-testid="track-height-label"][data-height-rail="33"]')
  await upper.focus()
  await upper.press('Enter')
  await expect(page.getByTestId('two-local-clearance')).toHaveValue('150')
  await page.getByTestId('two-local-clearance').fill('200')
  await expect(upper).toContainText('↕ 200 mm')
  await expect(page.getByTestId('two-rail-height')).toHaveValue('210')
  await page.getByTestId('planner-nav-3d').click()
  await page.getByTestId('three-display-settings').locator('summary').click()
  await page.getByTestId('three-height-rail').selectOption('33')
  await expect(page.getByTestId('three-local-clearance')).toHaveValue('200')
})
