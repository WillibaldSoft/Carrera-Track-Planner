import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import {
  emptyTrackPlan,
  createPitAssembly,
  enableFreePlacement,
  transformFreeParts,
} from '../../vendor/racehubos/shared/src/index.js'
const loop = () =>
  enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: [
      'Control_unit',
      'Standardgerade',
      ...Array(3).fill('Kurve_1_60_rechts'),
      'Standardgerade',
      'Standardgerade',
      ...Array(3).fill('Kurve_1_60_rechts'),
    ].map((type) => ({ type, level: 0, jointDegrees: 0 })),
  })
const rows = () =>
  transformFreeParts(
    enableFreePlacement({
      ...emptyTrackPlan(),
      pieces: Array.from({ length: 5 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
    }),
    [2, 3, 4],
    { degrees: 60, dx: 800, dy: 400 },
  )
async function open(page, plan, language = 'de') {
  await page.goto('/')
  await page.getByTestId('standalone-language').selectOption(language)
  await page.getByTestId('standalone-new').click()
  await page.locator('.planner-name').fill('CU and parallel demo')
  if (plan) {
    await page.getByTestId('planner-files-toggle').click()
    await page.getByTestId('track-plan-import').setInputFiles({
      name: 'cu-parallel.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(plan)),
    })
  }
}
async function pick(page, index, add = false) {
  const rail = page.getByTestId('graph-track-canvas').getByTestId(`rail-${index}`)
  await rail.focus()
  await rail.press(add ? 'Control+Enter' : 'Enter')
}
async function coordinate(page, id, expected) {
  await expect.poll(async () => Number(await page.getByTestId(id).inputValue())).toBeCloseTo(expected, 2)
}
for (const language of ['de', 'en', 'fr'])
  test(`curve edit anchors CU and cuts before it (${language})`, async ({ page }) => {
    await open(page, loop(), language)
    await pick(page, 3)
    await page.getByTestId('palette-Kurve_2_30_rechts').click()
    await expect(page.getByTestId('replacement-cut-select')).toHaveValue('6')
    await expect(page.getByTestId('replacement-cut-select').locator('option').last()).toContainText('10')
    await pick(page, 0)
    await coordinate(page, 'free-part-x', 0)
    await coordinate(page, 'free-part-y', 0)
    await coordinate(page, 'free-part-angle', 0)
    await page.screenshot({ path: `/tmp/planner-cu-fixed-${language}.png` })
    await page.getByTestId('track-undo').click()
    await pick(page, 0)
    await coordinate(page, 'free-part-x', 0)
    await page.getByTestId('track-redo').click()
    await pick(page, 0)
    await coordinate(page, 'free-part-x', 0)
  })
test('pit rails and switches are individually editable, assigned and dragged with undo', async ({ page }) => {
  await open(page)
  await page.getByTestId('start-pit-create').click()
  await pick(page, 1)
  await expect(page.getByTestId('combination-status')).toContainText('1')
  await page.getByTestId('pitlane-component-selection').locator('summary').click()
  const buttons = page.locator('[data-testid^="select-pit-component-extra-"]')
  await expect(buttons).not.toHaveCount(0)
  await buttons.first().click()
  await expect(page.getByTestId('pit-individual-controls')).toBeVisible()
  const original = Number(await page.getByTestId('pit-part-xMm').inputValue())
  await page.getByTestId('pit-part-xMm').fill(String(original + 100))
  await page.getByTestId('pit-part-xMm').press('Tab')
  await coordinate(page, 'pit-part-xMm', original + 100)
  await page.getByTestId('pit-part-carrier').selectOption('free')
  await coordinate(page, 'pit-part-xMm', original + 100)
  await page.getByTestId('pit-part-carrier').selectOption('3')
  await coordinate(page, 'pit-part-xMm', original + 100)
  const svg = page.getByTestId('graph-track-canvas'),
    native = svg.locator('[data-pit-part-id="extra-0"]')
  const box = await native.boundingBox()
  expect(box).toBeTruthy()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 + 10, { steps: 5 })
  await page.mouse.up()
  await expect
    .poll(async () => Number(await page.getByTestId('pit-part-xMm').inputValue()))
    .not.toBeCloseTo(original + 100, 2)
  await pick(page, 2)
  await coordinate(page, 'free-part-x', 690)
  await coordinate(page, 'free-part-y', 0)
  await page.screenshot({ path: '/tmp/planner-individual-pit.png' })
})
for (const language of ['de', 'en', 'fr'])
  test(`parallel docking previews and applies whole section with spacing and undo (${language})`, async ({ page }) => {
    await open(page, rows(), language)
    await pick(page, 0)
    await pick(page, 3, true)
    await page.getByTestId('parallel-docking-controls').locator('summary').click()
    await page.getByTestId('parallel-spacing').selectOption('198')
    await page.getByTestId('parallel-preview').click()
    await expect(page.getByTestId('parallel-docking-preview')).toBeVisible()
    await page.getByTestId('parallel-cancel').click()
    await expect(page.getByTestId('parallel-docking-preview')).toHaveCount(0)
    await page.getByTestId('parallel-preview').click()
    await coordinate(page, 'free-part-y', 1296.34)
    await page.screenshot({ path: `/tmp/planner-parallel-preview-${language}.png` })
    await page.getByTestId('parallel-apply').click()
    await pick(page, 3)
    await coordinate(page, 'free-part-y', 198)
    await coordinate(page, 'free-part-angle', 0)
    await page.getByTestId('track-undo').click()
    await pick(page, 3)
    await coordinate(page, 'free-part-angle', 60)
    await page.getByTestId('track-redo').click()
    await pick(page, 3)
    await coordinate(page, 'free-part-y', 198)
  })
test('remembered CU reference docks a single pit rail without moving main rails', async ({ page }) => {
  await open(page)
  await page.getByTestId('start-pit-create').click()
  await pick(page, 2)
  await page.getByTestId('parallel-docking-controls').locator('summary').click()
  await page.getByTestId('parallel-reference').click()
  await page.getByTestId('pitlane-component-selection').locator('summary').click()
  await page.locator('[data-testid^="select-pit-component-extra-"]').first().click()
  await page.getByTestId('parallel-preview').click()
  await expect(page.getByTestId('parallel-preview-status')).toContainText('148.5')
  await page.getByTestId('parallel-apply').click()
  await coordinate(page, 'pit-part-xMm', 862.5)
  await coordinate(page, 'pit-part-yMm', 148.5)
  await pick(page, 2)
  await coordinate(page, 'free-part-x', 690)
  await coordinate(page, 'free-part-y', 0)
})

test('two pit singles can be marked directly with Ctrl and docked at 99 mm', async ({ page }) => {
  await open(page)
  await page.getByTestId('start-pit-create').click()
  const svg = page.getByTestId('graph-track-canvas'),
    first = svg.locator('[data-pit-part-id="extra-0"]'),
    second = svg.locator('[data-pit-part-id="extra-1"]')
  await first.focus()
  await first.press('Enter')
  await second.focus()
  await second.press('Control+Enter')
  await page.getByTestId('parallel-docking-controls').locator('summary').click()
  await page.getByTestId('parallel-preview').click()
  await expect(page.getByTestId('parallel-preview-status')).toContainText('99')
  await page.getByTestId('parallel-apply').click()
  await coordinate(page, 'pit-part-xMm', 517.5)
  await coordinate(page, 'pit-part-yMm', 247.5)
})

test('imported legacy pit groups export as individual parts without an intermediate edit', async ({ page }) => {
  await open(page, createPitAssembly({ includeCU: true }))
  await page.getByTestId('planner-files-toggle').click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('export-track-json').click()
  const download = await downloadPromise,
    plan = JSON.parse(await fs.readFile(await download.path(), 'utf8'))
  expect(plan.partGroups.groups).toEqual([])
  expect(plan.pit.individualParts).toBe(true)
  expect(plan.trackExtras.filter((e) => e.fuelBay)).toHaveLength(2)
})
