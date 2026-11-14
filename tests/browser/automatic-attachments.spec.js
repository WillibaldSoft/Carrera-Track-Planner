import { revealControl } from './reveal-control.js'
import { test, expect } from '@playwright/test'
import { emptyTrackPlan } from '../../vendor/racehubos/shared/src/index.js'
async function open(page, lang = 'de') {
  await page.goto('/')
  await page.getByTestId('standalone-language').selectOption(lang)
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('add-track-piece').click()
  await page.getByTestId('room-background-visible').uncheck()
  await page.getByTestId('track-fit').click()
}
async function hoverRail(page, index = 0) {
  const rail = page.getByTestId('graph-track-canvas').getByTestId(`rail-${index}`)
  const p = await rail
    .locator('[data-rail-slots] path')
    .first()
    .evaluate((path) => {
      const q = path.getPointAtLength(path.getTotalLength() / 2)
      const p = new DOMPoint(q.x, q.y + 15).matrixTransform(path.getScreenCTM())
      return { x: p.x, y: p.y }
    })
  await page.mouse.move(p.x, p.y)
  await expect(page.getByTestId('automatic-attachments')).toBeVisible()
}

for (const lang of ['de', 'en', 'fr'])
  test(`automatic shoulders and end pieces preview, attach and undo (${lang})`, async ({ page }) => {
    await open(page, lang)
    await revealControl(page.getByTestId('track-auto-attachments'))
    await page.getByTestId('track-auto-attachments').click()
    await expect(page.getByTestId('graph-track-canvas').getByTestId('track-connector')).toHaveCount(0)
    await expect(page.getByTestId('connection-hints')).toHaveCount(0)
    await hoverRail(page)
    await expect(page.getByTestId('automatic-attachment-target')).toHaveCount(1)
    await page.getByTestId('auto-attach-left').hover()
    await expect(page.getByTestId('automatic-attachment-preview')).toHaveCount(1)
    await page.getByTestId('auto-attach-left').click()
    await revealControl(page.getByTestId('track-auto-attachments'))
    await page.getByTestId('track-auto-attachments').focus()
    await hoverRail(page)
    await expect(page.getByTestId('auto-attach-left')).toHaveCount(0)
    await page.getByTestId('auto-attach-left-startCap').click()
    await expect(page.getByTestId('graph-track-canvas').getByTestId('border-shape-0-left-startCap')).toHaveCount(1)
    await page.getByTestId('track-undo').click()
    await expect(page.getByTestId('graph-track-canvas').getByTestId('border-shape-0-left-startCap')).toHaveCount(0)
    await page.getByTestId('track-redo').click()
    await expect(page.getByTestId('graph-track-canvas').getByTestId('border-shape-0-left-startCap')).toHaveCount(1)
  })
test('central toolbar centres a marked rail without moving it and restores full fit', async ({ page }) => {
  await open(page)
  for (let i = 0; i < 5; i++) await page.getByTestId('add-track-piece').click()
  const canvas = page.getByTestId('graph-track-canvas'),
    rail = canvas.getByTestId('rail-3')
  await rail.focus()
  await rail.press('Enter')
  const x = await page.getByTestId('free-part-x').inputValue(),
    y = await page.getByTestId('free-part-y').inputValue()
  const before = (await canvas.getAttribute('viewBox')).split(' ').map(Number)
  await page.getByTestId('track-center-selection').click()
  const after = (await canvas.getAttribute('viewBox')).split(' ').map(Number)
  expect(after[2]).toBeLessThan(before[2])
  expect(after[0] + after[2] / 2).toBeCloseTo(Number(x) + 172.5, 1)
  await expect(page.getByTestId('free-part-x')).toHaveValue(x)
  await expect(page.getByTestId('free-part-y')).toHaveValue(y)
  await page.getByTestId('track-fit').click()
  const full = (await canvas.getAttribute('viewBox')).split(' ').map(Number)
  expect(full[2]).toBeGreaterThan(after[2])
  const toolbar = page.getByRole('toolbar')
  await revealControl(toolbar.getByTestId('tools-box'))
  await expect(toolbar.getByTestId('tools-box')).toBeVisible()
  await revealControl(toolbar.getByTestId('tools-audit'))
  await expect(toolbar.getByTestId('tools-audit')).toBeVisible()
  await revealControl(toolbar.getByTestId('toolbar-parallel'))
  await expect(toolbar.getByTestId('toolbar-parallel')).toBeVisible()
  await page.locator('.planner-name').fill('Central toolbar demo')
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/tracks') && r.request().method() === 'POST')
  await page.getByTestId('planner-save').click()
  expect((await saved).ok()).toBe(true)
  await page.getByTestId('planner-nav-files').click()
  await expect(page.getByTestId('planner-files')).toBeVisible()
})

test('toolbar centres and removes a single pit part and restores it with undo', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('start-pit-create').click()
  const svg = page.getByTestId('graph-track-canvas'),
    part = svg.locator('[data-pit-part-id="extra-0"]')
  await part.focus()
  await part.press('Enter')
  const x = await page.getByTestId('pit-part-xMm').inputValue()
  await page.getByTestId('track-center-selection').click()
  await expect(page.getByTestId('pit-part-xMm')).toHaveValue(x)
  const count = await svg.locator('[data-pit-part-id]').count()
  await revealControl(page.getByTestId('toolbar-delete-selection'))
  await page.getByTestId('toolbar-delete-selection').click()
  await expect(svg.locator('[data-pit-part-id]')).toHaveCount(count - 1)
  await page.getByTestId('track-undo').click()
  await expect(svg.locator('[data-fuel-artwork="striped-sensor"]')).toHaveCount(2)
  await revealControl(page.getByTestId('toolbar-parallel'))
  await page.getByTestId('toolbar-parallel').click()
  await expect(page.getByTestId('parallel-docking-controls')).toHaveAttribute('open', '')
})

test('centring a grouped assembly includes every highlighted member', async ({ page }) => {
  await open(page)
  await page.getByTestId('add-track-piece').click()
  await page.getByTestId('add-track-piece').click()
  const canvas = page.getByTestId('graph-track-canvas')
  await canvas.focus()
  await canvas.press('Control+a')
  await page.getByTestId('group-track-parts').click()
  const rail = canvas.getByTestId('rail-2')
  await rail.focus()
  await rail.press('Enter')
  await page.getByTestId('track-center-selection').click()
  const b = (await canvas.getAttribute('viewBox')).split(' ').map(Number)
  expect(b[2]).toBeGreaterThanOrEqual(1235)
  expect(b[0] + b[2] / 2).toBeCloseTo(517.5, 1)
})

for (const side of ['left', 'right', 'both'])
  test(`automatic shoulder brush retains ${side} and continues one rail per click with undo`, async ({ page }) => {
    await open(page)
    await page.getByTestId('add-track-piece').click()
    await page.getByTestId('add-track-piece').click()
    await page.getByTestId('track-fit').click()
    await revealControl(page.getByTestId('track-auto-attachments'))
    await page.getByTestId('track-auto-attachments').click()
    await page.getByTestId('auto-border-side').selectOption(side)
    await hoverRail(page, 0)
    const boxBefore = await page.getByTestId('graph-track-canvas').getAttribute('viewBox')
    await page.getByTestId('auto-attach-continue').click()
    const canvas = page.getByTestId('graph-track-canvas')
    await expect(canvas).toHaveAttribute('viewBox', boxBefore)
    for (const edge of ['left', 'right'])
      await expect(canvas.getByTestId(`border-shape-0-${edge}-strip`)).toHaveCount(
        side === 'both' || side === edge ? 1 : 0,
      )
    await expect(page.getByTestId('automatic-attachments')).toContainText('2')
    await expect(page.getByTestId('auto-border-side')).toHaveValue(side)
    await page.getByTestId('auto-attach-continue').click()
    for (const edge of ['left', 'right'])
      await expect(canvas.getByTestId(`border-shape-1-${edge}-strip`)).toHaveCount(
        side === 'both' || side === edge ? 1 : 0,
      )
    await expect(page.getByTestId('auto-border-side')).toHaveValue(side)
    await page.getByTestId('track-undo').click()
    await expect(canvas.locator('[data-testid^="border-shape-1-"]')).toHaveCount(0)
    await page.getByTestId('track-redo').click()
    await expect(canvas.locator('[data-testid^="border-shape-1-"]')).toHaveCount(side === 'both' ? 2 : 1)
    // A direct click places the next rail, without selecting/dragging the track.
    await hoverRail(page, 2)
    const rail = canvas.getByTestId('rail-2')
    const point = await rail
      .locator('[data-slot-layer="groove"]')
      .first()
      .evaluate((path) => {
        const p = path.getPointAtLength(path.getTotalLength() / 2)
        const q = new DOMPoint(p.x, p.y + 15).matrixTransform(path.getScreenCTM())
        return { x: q.x, y: q.y }
      })
    await page.mouse.click(point.x, point.y)
    await expect(canvas.locator('[data-testid^="border-shape-2-"]')).toHaveCount(side === 'both' ? 2 : 1)
    await expect(page.getByTestId('auto-border-side')).toHaveValue(side)
    await expect(canvas.getByTestId('border-artwork').first()).toBeAttached()
  })

test('curve-specific shoulders continue with matching articles and export as individual vector artwork', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('planner-nav-files').click()
  const source = {
    ...emptyTrackPlan(),
    pieces: ['Standardgerade', 'Kurve_1_60_rechts', 'Kurve_2_30_links'].map((type) => ({
      type,
      level: 0,
      jointDegrees: 0,
    })),
  }
  await page.getByTestId('track-plan-import').setInputFiles({
    name: 'curved-shoulders.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(source)),
  })
  await page.getByTestId('planner-nav-editor').click()
  await page.getByTestId('track-fit').click()
  await revealControl(page.getByTestId('track-auto-attachments'))
  await page.getByTestId('track-auto-attachments').click()
  await page.getByTestId('auto-border-side').selectOption('left')
  await hoverRail(page, 0)
  for (let i = 0; i < 3; i++) await page.getByTestId('auto-attach-continue').click()
  const canvas = page.getByTestId('graph-track-canvas')
  await expect(canvas.getByTestId('border-shape-1-left-strip').locator('title')).toContainText('20561')
  await expect(canvas.getByTestId('border-shape-2-left-strip').locator('title')).toContainText('20591')
  await expect(canvas.locator('[data-border-side="right"]')).toHaveCount(0)
  await revealControl(page.getByTestId('track-auto-attachments'))
  await page.getByTestId('track-auto-attachments').click()
  const controls = page.getByTestId('planner-image-export').filter({ has: canvas })
  let pending = page.waitForEvent('download')
  await revealControl(controls.getByTestId('export-image-svg'))
  await controls.getByTestId('export-image-svg').click()
  const svg = await (await pending).createReadStream()
  const chunks = []
  for await (const chunk of svg) chunks.push(chunk)
  const xml = Buffer.concat(chunks).toString()
  expect(xml).toContain('border-artwork')
  expect(xml).not.toMatch(/<pattern[^>]+id="[^"]*-border"/)
  pending = page.waitForEvent('download')
  await revealControl(controls.getByTestId('export-image-pdf'))
  await controls.getByTestId('export-image-pdf').click()
  const pdf = await pending
  await pdf.saveAs('test-results/curved-shoulders-vector.pdf')
  expect(errors).toEqual([])
})

test('left stays left in driving direction on a reversed connected rail and repeated clicks do not paint the opposite side', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('planner-nav-files').click()
  const source = {
    ...emptyTrackPlan(),
    freePlacement: true,
    pieces: [
      { xMm: 0, yMm: 0, headingDegrees: 0 },
      { xMm: 690, yMm: 0, headingDegrees: 180 },
      { xMm: 690, yMm: 0, headingDegrees: 0 },
    ].map((placement) => ({ type: 'Standardgerade', level: 0, jointDegrees: 0, placement })),
  }
  await page.getByTestId('track-plan-import').setInputFiles({
    name: 'reversed-shoulder.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(source)),
  })
  await page.getByTestId('planner-nav-editor').click()
  await revealControl(page.getByTestId('track-auto-attachments'))
  await page.getByTestId('track-auto-attachments').click()
  await page.getByTestId('auto-border-side').selectOption('left')
  await hoverRail(page, 1)
  const canvas = page.getByTestId('graph-track-canvas')
  const point = await canvas
    .getByTestId('rail-1')
    .locator('[data-slot-layer="groove"]')
    .first()
    .evaluate((path) => {
      const p = path.getPointAtLength(path.getTotalLength() / 2),
        q = new DOMPoint(p.x, p.y + 15).matrixTransform(path.getScreenCTM())
      return { x: q.x, y: q.y }
    })
  await page.mouse.dblclick(point.x, point.y)
  await expect(canvas.getByTestId('border-shape-1-right-strip')).toHaveCount(1)
  await expect(canvas.getByTestId('border-shape-1-left-strip')).toHaveCount(0)
  await expect(canvas.locator('[data-testid^="border-shape-2-"]')).toHaveCount(0)
  await page.getByTestId('auto-attach-continue').click()
  await expect(canvas.getByTestId('border-shape-2-left-strip')).toHaveCount(1)
  await expect(page.getByTestId('auto-border-side')).toHaveValue('left')
})
