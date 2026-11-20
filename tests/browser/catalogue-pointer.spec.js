import { test, expect } from '@playwright/test'
test.beforeEach(({ page }) => { page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message)) })
async function open(page) {
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
}
async function at(page, x, y) {
  return page.getByTestId('graph-track-canvas').evaluate((svg, { x, y }) => {
    const p = svg.createSVGPoint(); p.x = x; p.y = y
    const q = p.matrixTransform(svg.getScreenCTM()); return { x: q.x, y: q.y }
  }, { x, y })
}
test('catalogue pins once, snaps at the next end, and cancels with Escape', async ({ page }) => {
  await open(page)
  const svg = page.getByTestId('graph-track-canvas')
  for (const [x, count] of [[0, 1], [350, 2]]) {
    await page.getByTestId('palette-Standardgerade').click()
    const p = await at(page, x, 0)
    await page.mouse.move(p.x, p.y)
    await expect(page.getByTestId('repeat-track-preview')).toBeVisible()
    if (count === 2) await expect(page.getByTestId('repeat-track-preview')).toHaveAttribute('data-action', 'snap')
    await page.mouse.click(p.x, p.y)
    await expect(svg).toHaveAttribute('data-piece-count', String(count))
    await expect(page.getByTestId('repeat-track-preview')).toHaveCount(0)
  }
  await page.getByTestId('palette-Drittelgerade').click()
  const p = await at(page, 172.5, 0)
  await page.mouse.move(p.x, p.y)
  await expect(page.getByTestId('repeat-track-preview')).toHaveAttribute('data-action', 'replace')
  await page.screenshot({ path: '/tmp/planner-catalogue-pointer.png' })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('repeat-track-preview')).toHaveCount(0)
  await expect(svg).toHaveAttribute('data-piece-count', '2')
})
test('Ctrl wheel and Ctrl Page Up/Down zoom the drawing without browser zoom', async ({ page }) => {
  await open(page)
  const svg = page.getByTestId('graph-track-canvas')
  await svg.focus()
  const width = () => svg.evaluate((el) => el.viewBox.baseVal.width)
  const before = await width()
  await page.keyboard.press('Control+PageUp')
  expect(await width()).toBeLessThan(before)
  await page.keyboard.press('Control+PageDown')
  expect(await width()).toBeCloseTo(before, 3)
  await svg.hover()
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -120)
  await page.keyboard.up('Control')
  await expect.poll(width).toBeLessThan(before)
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1)
})
