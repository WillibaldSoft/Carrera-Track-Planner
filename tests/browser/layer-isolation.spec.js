import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import { emptyTrackPlan } from '../../vendor/racehubos/shared/src/index.js'
const fixture = () => ({
  ...emptyTrackPlan(),
  freePlacement: true,
  pieces: [0, 1, 2].map((level) => ({
    type: 'Standardgerade',
    level,
    jointDegrees: 0,
    placement: { xMm: 0, yMm: 0, headingDegrees: level === 1 ? 90 : 0 },
    borders: { left: { startCap: false, endCap: false } },
  })),
  trackExtras: [0, 1].map((anchor) => ({
    kind: 'single',
    anchor,
    level: 0,
    paintOrder: 0,
    placement: { xMm: 172.5, yMm: 300, headingDegrees: 0 },
  })),
})
async function open(page, lang, plan = fixture()) {
  await page.goto('/')
  await page.getByTestId('standalone-language').selectOption(lang)
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('planner-files-toggle').click()
  await page
    .getByTestId('track-plan-import')
    .setInputFiles({ name: 'levels.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(plan)) })
}
for (const lang of ['de', 'en', 'fr'])
  test(`isolate and edit overlapping levels without hidden handles (${lang})`, async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await open(page, lang)
    const svg = page.getByTestId('graph-track-canvas'),
      filter = page.getByTestId('toolbar-layer-filter')
    const lowerPath = await svg.getByTestId('rail-0').locator('path').first().getAttribute('d')
    await svg.getByTestId('rail-2').focus()
    await svg.getByTestId('rail-2').press('Enter')
    await filter.selectOption('0')
    await expect(svg).toHaveAttribute('data-selected-count', '0')
    await expect(svg.getByTestId('rail-0')).toHaveCount(1)
    await expect(svg.getByTestId('rail-1')).toHaveCount(0)
    await expect(svg.locator('[data-pit-part-id="extra-0"]')).toHaveCount(1)
    await expect(svg.locator('[data-pit-part-id="extra-1"]')).toHaveCount(0)
    await expect(svg.getByTestId('open-port-1-0')).toHaveCount(0)
    const dir = `docs/screenshots/layer-isolation/${lang}`
    await fs.mkdir(dir, { recursive: true })
    await page.screenshot({ path: `${dir}/01-lower-level.png` })
    await filter.selectOption('1')
    await expect(svg.getByTestId('rail-0')).toHaveCount(0)
    await expect(svg.getByTestId('rail-1')).toHaveCount(1)
    await expect(svg.getByTestId('border-shape-0-left-strip')).toHaveCount(0)
    await expect(svg.locator('[data-pit-part-id="extra-1"]')).toHaveCount(1)
    await svg.focus()
    await page.keyboard.press('Control+a')
    await expect(svg).toHaveAttribute('data-selected-count', '1')
    await page.getByTestId('free-part-x').fill('200')
    await page.getByTestId('free-part-x').press('Tab')
    await expect(page.getByTestId('free-part-x')).toHaveValue('200')
    await page.screenshot({ path: `${dir}/02-upper-level-edit.png` })
    await page.getByTestId('add-track-piece').click()
    await expect(svg).toHaveAttribute('data-piece-count', '4')
    await expect(page.getByTestId('selected-track-level')).toHaveValue('1')
    await page.getByTestId('track-undo').click()
    await expect(svg).toHaveAttribute('data-piece-count', '3')
    await filter.selectOption('all')
    await expect(svg.getByTestId('rail-0').locator('path').first()).toHaveAttribute('d', lowerPath)
    for (let i = 0; i < 3; i++) await expect(svg.getByTestId(`rail-${i}`)).toHaveCount(1)
    await page.screenshot({ path: `${dir}/03-all-levels.png` })
    expect(errors).toEqual([])
  })
test('mixed-level group cannot silently move hidden rails', async ({ page }) => {
  const plan = fixture()
  plan.trackExtras = []
  plan.pit.individualParts = true
  plan.partGroups = { groups: [[0, 1]], released: [] }
  await open(page, 'de', plan)
  await page.getByTestId('toolbar-layer-filter').selectOption('0')
  const rail = page.getByTestId('graph-track-canvas').getByTestId('rail-0')
  await rail.focus()
  await rail.press('Enter')
  await expect(page.getByTestId('layer-group-warning')).toBeVisible()
  await expect(page.getByTestId('graph-track-canvas')).toHaveAttribute('data-selected-count', '0')
})
test('visibility isolates drawing offsets and independently lowered shoulders', async ({ page }) => {
  const plan = fixture()
  plan.pieces[0].drawLayer = 2
  plan.pieces[0].borders.left.drawLayer = -1
  await open(page, 'de', plan)
  const svg = page.getByTestId('graph-track-canvas'),
    filter = page.getByTestId('toolbar-layer-filter')
  await filter.selectOption('-1')
  await expect(svg.getByTestId('rail-0')).toHaveCount(0)
  await expect(svg.getByTestId('border-shape-0-left-strip')).toHaveCount(1)
  await svg.getByTestId('border-shape-0-left-strip').click()
  await expect(page.getByTestId('graph-track-canvas')).toHaveAttribute('data-selected-count', '1')
  await page.getByTestId('drawing-layer-controls').locator('summary').click()
  await expect(page.getByTestId('drawing-layer-target')).toHaveValue('left')
  await filter.selectOption('2')
  await expect(svg.getByTestId('rail-0')).toHaveCount(1)
  await expect(svg.getByTestId('border-shape-0-left-strip')).toHaveCount(0)
  await filter.selectOption('all')
  await expect(svg.getByTestId('border-shape-0-left-strip')).toHaveCount(1)
})
