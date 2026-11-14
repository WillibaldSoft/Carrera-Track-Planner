import { test, expect } from '@playwright/test'
import { emptyTrackPlan } from '../../vendor/racehubos/shared/src/trackPlan.js'
const source = {
  ...emptyTrackPlan(),
  pieces: Array.from({ length: 6 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
}
const label = (page, i) => page.locator(`[data-testid="track-height-label"][data-height-rail="${i}"]`)
async function worldCenter(card) {
  return card.evaluate((n) => {
    const b = n.getBoundingClientRect()
    const p = new DOMPoint(b.x + b.width / 2, b.y + b.height / 2).matrixTransform(
      n.closest('svg').getScreenCTM().inverse(),
    )
    return { x: p.x, y: p.y }
  })
}
async function open(page, lang = 'de') {
  await page.goto('/')
  await page.getByTestId('standalone-language').selectOption(lang)
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('planner-nav-files').click()
  await page
    .getByTestId('track-plan-import')
    .setInputFiles({ name: 'labels.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) })
  await page.getByTestId('planner-nav-editor').click()
  await page.locator('.planner-name').fill('Manual labels ' + lang)
  await page.getByTestId('show-track-elevations').check()
}
async function save(page, method) {
  const pending = page.waitForResponse((r) => r.request().method() === method && /\/api\/tracks(?:\/|$)/.test(r.url()))
  await page.getByTestId('planner-save').click()
  return (await (await pending).json()).data
}
for (const lang of ['de', 'en', 'fr'])
  test(`manual drag, native save/reload, keyboard, undo and automatic reset (${lang})`, async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await open(page, lang)
    const row = await save(page, 'POST'),
      baseline = JSON.parse(row.layout),
      card = label(page, 2),
      initial = await card.boundingBox()
    const roadY = await page
      .getByTestId('graph-track-canvas')
      .evaluate((svg) => new DOMPoint(862.5, 0).matrixTransform(svg.getScreenCTM()).y)
    const dy = initial.y + initial.height / 2 < roadY ? -100 : 100
    await page.mouse.move(initial.x + initial.width / 2, initial.y + initial.height / 2)
    await page.mouse.down()
    await page.mouse.move(initial.x + initial.width / 2 + 80, initial.y + initial.height / 2 + dy, { steps: 8 })
    await page.mouse.up()
    await expect(card).toHaveAttribute('data-label-manual', 'true')
    const moved = await card.boundingBox()
    expect(Math.hypot(moved.x - initial.x, moved.y - initial.y)).toBeGreaterThan(20)
    const saved = JSON.parse((await save(page, 'PUT')).layout)
    expect(saved.pieces[2].heightLabelOffset).toEqual({ alongMm: expect.any(Number), acrossMm: expect.any(Number) })
    const geometry = {
      ...saved,
      pieces: saved.pieces.map((p) => {
        const q = { ...p }
        delete q.heightLabelOffset
        return q
      }),
    }
    expect(geometry).toEqual(baseline)
    await page.getByTestId('track-undo').click()
    await expect(card).toHaveAttribute('data-label-manual', 'false')
    await page.getByTestId('track-redo').click()
    await expect(card).toHaveAttribute('data-label-manual', 'true')
    await save(page, 'PUT')
    await page.reload()
    await page.getByTestId('standalone-track').selectOption(row.id)
    await expect(card).toHaveAttribute('data-label-manual', 'true')
    const expectedWorld = {
      x: 2.5 * 345 + saved.pieces[2].heightLabelOffset.alongMm,
      y: saved.pieces[2].heightLabelOffset.acrossMm,
    }
    await expect
      .poll(async () => {
        const p = await worldCenter(card)
        return Math.hypot(p.x - expectedWorld.x, p.y - expectedWorld.y)
      })
      .toBeLessThan(0.02)
    const reopenedWorld = await worldCenter(card)
    await card.focus()
    await card.press('ArrowRight')
    await expect.poll(async () => (await worldCenter(card)).x).toBeGreaterThan(reopenedWorld.x + 0.1)
    await label(page, 4).focus()
    await label(page, 4).press('ArrowUp')
    await expect(label(page, 4)).toHaveAttribute('data-label-manual', 'true')
    await page.getByTestId('arrange-height-labels').click()
    await expect(card).toHaveAttribute('data-label-manual', 'false')
    await expect(label(page, 4)).toHaveAttribute('data-label-manual', 'false')
    const automaticallySaved = JSON.parse((await save(page, 'PUT')).layout)
    expect(automaticallySaved).toEqual(baseline)
    await page.getByTestId('track-undo').click()
    await expect(card).toHaveAttribute('data-label-manual', 'true')
    await card.click()
    await page.getByTestId('reset-selected-height-label').click()
    await expect(card).toHaveAttribute('data-label-manual', 'false')
    await expect(label(page, 4)).toHaveAttribute('data-label-manual', 'true')
    await label(page, 4).focus()
    await label(page, 4).press('Delete')
    await expect(label(page, 4)).toHaveAttribute('data-label-manual', 'false')
    expect(errors).toEqual([])
  })
test.describe('touch drag', () => {
  test.use({ hasTouch: true })
  test('moves the annotation on a small screen without moving the rail', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await open(page)
    const card = label(page, 2),
      b = await card.boundingBox(),
      client = await page.context().newCDPSession(page)
    const x = b.x + b.width / 2,
      y = b.y + b.height / 2
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 35, y: y - 65, id: 1 }] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(card).toHaveAttribute('data-label-manual', 'true')
    const plan = JSON.parse((await save(page, 'POST')).layout)
    expect(plan.pieces[2].heightLabelOffset).toBeDefined()
    expect(plan.pieces.map((p) => p.type)).toEqual(source.pieces.map((p) => p.type))
    const canvas = await page.getByTestId('graph-track-canvas').boundingBox()
    expect(canvas.height).toBeGreaterThan(100)
  })
})
