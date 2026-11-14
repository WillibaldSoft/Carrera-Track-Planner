import { test, expect } from '@playwright/test'
import { DEFAULT_ROOM, emptyTrackPlan, readTrackPlan } from '../../vendor/racehubos/shared/src/index.js'
import { roomFitContext, roomPolygonsFit, trackRoomPolygons } from '../../vendor/racehubos/shared/src/roomTrackFit.js'
async function start(page) {
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
}
test('fractional room origin and dropped rail save immediately without editing coordinates', async ({ page }) => {
  await start(page)
  await page.getByTestId('room-continue').click()
  await page.locator('.planner-name').fill('Drop without coordinate correction')
  const plan = {
    ...emptyTrackPlan(),
    measuredLaneLengthsM: [1.23456789, 1.98765432],
    roomPlan: { ...DEFAULT_ROOM, backgroundOrigin: { xMm: -3000.125, yMm: -1700.375 } },
  }
  await page.getByTestId('planner-nav-files').click()
  await page
    .getByTestId('track-plan-import')
    .setInputFiles({ name: 'room.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(plan)) })
  await page.getByTestId('graph-track-canvas').evaluate((svg) => {
    const b = svg.getBoundingClientRect(),
      d = new DataTransfer()
    d.setData('application/x-racehub-track-part', 'Kurve_1_60_rechts')
    svg.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        clientX: b.x + b.width * 0.4137,
        clientY: b.y + b.height * 0.3723,
        dataTransfer: d,
      }),
    )
  })
  await expect(page.getByTestId('graph-track-canvas')).toHaveAttribute('data-piece-count', '1')
  expect(await page.locator('form').evaluate((f) => f.checkValidity())).toBe(true)
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/tracks') && r.request().method() === 'POST')
  await page.getByTestId('planner-save').click()
  const res = await saved
  expect(res.ok()).toBe(true)
  const value = JSON.parse((await res.json()).data.layout)
  expect(readTrackPlan(value)).toBeTruthy()
  expect(value.pieces[0].placement.xMm * 1000).toBeCloseTo(Math.round(value.pieces[0].placement.xMm * 1000), 6)
  expect(value.roomPlan.backgroundOrigin).toEqual(plan.roomPlan.backgroundOrigin)
})
for (const lang of ['de', 'en', 'fr'])
  test(`automatic room search uses alcove and avoids chimney (${lang})`, async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/')
    await page.getByTestId('standalone-language').selectOption(lang)
    await page.getByTestId('standalone-new').click()
    await page.locator('.planner-name').fill('Room-fit ' + lang)
    await page.getByTestId('room-widthM').fill('1.2')
    await page.getByTestId('room-drivers').fill('1')
    await page.getByTestId('room-driverWidthM').fill('0.4')
    await page.getByTestId('room-add-extension').click()
    await page.getByTestId('room-feature-widthM').fill('3')
    await page.getByTestId('room-feature-depthM').fill('3.2')
    await page.getByTestId('room-add-obstacle').click()
    await page.getByTestId('room-feature-widthM').fill('0.6')
    await page.getByTestId('room-feature-depthM').fill('0.6')
    await page.getByTestId('generate-room-plan').click()
    await expect(page.getByTestId('room-proposal-oval')).toBeVisible({ timeout: 45000 })
    const previewTransform = await page
      .getByTestId('room-proposal-oval')
      .getByTestId('room-plan-preview')
      .locator(':scope > g[transform]')
      .last()
      .getAttribute('transform')
    await page.getByTestId('apply-room-oval').click()
    await expect(page.getByTestId('track-room-background')).toBeVisible()
    await expect(page.getByTestId('saved-room-fit-warning')).toHaveCount(0)
    expect(await page.locator('form').evaluate((f) => f.checkValidity())).toBe(true)
    const saved = page.waitForResponse((r) => r.url().endsWith('/api/tracks') && r.request().method() === 'POST')
    await page.getByTestId('planner-save').click()
    const res = await saved
    expect(res.ok()).toBe(true)
    const p = JSON.parse((await res.json()).data.layout),
      o = p.roomPlan.backgroundOrigin
    expect(previewTransform).toBe(`translate(${-o.xMm} ${-o.yMm})`)
    expect(roomPolygonsFit(trackRoomPolygons(p), roomFitContext(p.roomPlan), -o.xMm, -o.yMm)).toBe(true)
    expect(
      trackRoomPolygons(p)
        .flat()
        .some((v) => v[0] - o.xMm > 1200),
    ).toBe(true)
  })
test('fully blocked room returns no suggestion and a localized reason', async ({ page }) => {
  await start(page)
  await page.getByTestId('room-widthM').fill('2')
  await page.getByTestId('room-depthM').fill('3')
  await page.getByTestId('room-drivers').fill('1')
  await page.getByTestId('room-driverWidthM').fill('0.4')
  await page.getByTestId('room-add-obstacle').click()
  await page.getByTestId('room-feature-widthM').fill('2')
  await page.getByTestId('room-feature-depthM').fill('3')
  await page.getByTestId('generate-room-plan').click()
  await expect(page.getByRole('alert').filter({ hasText: /Raumkontur|footprint|contour/ })).toBeVisible({
    timeout: 30000,
  })
  await expect(page.getByTestId('room-proposal-oval')).toHaveCount(0)
})

test('contour-aware standard search can be cancelled without applying a proposal', async ({ page }) => {
  await start(page)
  await page.getByTestId('room-add-obstacle').click()
  await page.getByTestId('generate-room-plan').click()
  await page.getByTestId('cancel-track-search').click()
  await expect(page.getByTestId('search-progress')).toHaveCount(0)
  await expect(page.getByTestId('room-proposal-oval')).toHaveCount(0)
  await expect(page.getByTestId('room-continue')).toBeEnabled()
})
