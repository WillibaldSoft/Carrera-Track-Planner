import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { traceTrackPlan } from '../../vendor/racehubos/shared/src/trackPlan.js'
const source = JSON.parse(
  fs.readFileSync(new URL('../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url)),
)
async function open(page) {
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('planner-files-toggle').click()
  await page
    .getByTestId('track-plan-import')
    .setInputFiles({ name: 'layout.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) })
  await page.getByTestId('planner-mode').selectOption('editor')
  await page.locator('.planner-name').fill('Label layout')
  await page.getByTestId('show-track-elevations').check()
}
async function boxes(page) {
  return page.getByTestId('track-height-label').evaluateAll((nodes) =>
    nodes.map((n) => {
      const r = n.querySelector('rect').getBoundingClientRect(),
        text = n.querySelector('text'),
        m = text.getScreenCTM()
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        font: parseFloat(getComputedStyle(text).fontSize) * Math.hypot(m.a, m.b),
      }
    }),
  )
}
async function check(page) {
  const canvas = await page.getByTestId('graph-track-canvas').boundingBox(),
    cards = await boxes(page)
  const problems = []
  for (let i = 0; i < cards.length; i++) {
    const a = cards[i]
    if (
      a.x < canvas.x ||
      a.y < canvas.y ||
      a.x + a.width > canvas.x + canvas.width ||
      a.y + a.height > canvas.y + canvas.height
    )
      problems.push({ kind: 'bounds', i, a, canvas })
    if (a.font < 9.5 || a.font > 12.5) problems.push({ kind: 'font', i, a })
    for (let j = i + 1; j < cards.length; j++) {
      const b = cards[j]
      if (!(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y))
        problems.push({ kind: 'overlap', i, j, a, b })
    }
  }
  expect(problems).toEqual([])
  return cards
}
test('overview annotations are separate, readable and outside rail surfaces', async ({ page }) => {
  await open(page)
  const cards = await check(page)
  expect(cards.length).toBeGreaterThan(3)
  const matrix = await page.getByTestId('graph-track-canvas').evaluate((svg) => {
    const m = svg.getScreenCTM()
    return { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f }
  })
  const radius = 99 * Math.hypot(matrix.a, matrix.b)
  let minimumRoadDistance = Infinity
  for (const s of traceTrackPlan(source).segments)
    for (const [x, y] of s.points[0]) {
      const px = matrix.a * x + matrix.c * y + matrix.e,
        py = matrix.b * x + matrix.d * y + matrix.f
      for (const r of cards) {
        const dx = Math.max(r.x - px, 0, px - r.x - r.width),
          dy = Math.max(r.y - py, 0, py - r.y - r.height)
        minimumRoadDistance = Math.min(minimumRoadDistance, Math.hypot(dx, dy))
      }
    }
  expect(minimumRoadDistance).toBeGreaterThan(radius - 1)
})
test('zoom, selected-part fit and resizing preserve spacing without editing the saved plan', async ({ page }) => {
  await open(page)
  let pending = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/tracks'))
  await page.getByTestId('planner-save').click()
  const baseline = JSON.parse((await (await pending).json()).data.layout)
  const upper = page.locator('[data-testid="track-height-label"][data-height-rail="33"]')
  await upper.focus()
  await upper.press('Enter')
  await page.getByTestId('graph-track-canvas').focus()
  await page.getByTestId('graph-track-canvas').press('f')
  await check(page)
  await page.getByTestId('track-zoom-slider').focus()
  await page.getByTestId('track-zoom-slider').press('Home')
  await check(page)
  await page.getByTestId('track-zoom-slider').press('End')
  await check(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await check(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByTestId('track-fit').click()
  await check(page)
  pending = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/api/tracks/'))
  await page.getByTestId('planner-save').click()
  const after = JSON.parse((await (await pending).json()).data.layout)
  expect(after).toEqual(baseline)
})
