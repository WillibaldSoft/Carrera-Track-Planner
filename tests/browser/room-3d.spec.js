import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { DEFAULT_ROOM } from '../../vendor/racehubos/shared/src/index.js'
const source = JSON.parse(
  fs.readFileSync(new URL('../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url)),
)
const room = {
  ...DEFAULT_ROOM,
  features: [
    { id: 'k', name: 'Kamin', kind: 'obstacle', xM: 0, yM: 0, widthM: 0.8, depthM: 0.6 },
    { id: 'n', name: 'Nische', kind: 'extension', xM: 6, yM: 1, widthM: 1, depthM: 2 },
  ],
}
for (const lang of ['de', 'en', 'fr'])
  test(`3D room view orbits, uses 150 mm clearance, exports and preserves the plan (${lang})`, async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await page.getByTestId('standalone-language').selectOption(lang)
    await page.getByTestId('standalone-new').click()
    await page.getByTestId('room-continue').click()
    await page.getByTestId('planner-files-toggle').click()
    await page.getByTestId('track-plan-import').setInputFiles({
      name: '3d.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ ...source, roomPlan: room })),
    })
    await page.locator('.planner-name').fill('3D room ' + lang)
    let saved = page.waitForResponse((r) => r.url().endsWith('/api/tracks') && r.request().method() === 'POST')
    await page.getByTestId('planner-save').click()
    const baseline = JSON.parse((await (await saved).json()).data.layout)
    await expect(page.getByTestId('planner-save')).toBeEnabled()
    await page.getByTestId('toolbar-open-3d').click()
    const view = page.getByTestId('room-track-3d'),
      svg = page.getByTestId('room-3d-canvas')
    await expect(svg).toBeVisible()
    await expect(svg.locator('[data-3d-kind="wall"]')).not.toHaveCount(0)
    await expect(svg.locator('[data-3d-kind="obstacle"]')).not.toHaveCount(0)
    await expect(svg.locator('[data-3d-art="fuel"]')).toHaveCount(2)
    const original = await svg.getAttribute('viewBox'),
      b = await svg.boundingBox()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2 + 100, b.y + b.height / 2 - 40, { steps: 5 })
    await page.mouse.up()
    await expect(svg).not.toHaveAttribute('data-yaw', '-35')
    await page.mouse.wheel(0, -250)
    await expect(svg).not.toHaveAttribute('viewBox', original)
    await view.getByTestId('three-display-settings').locator('summary').click()
    await expect(view.getByTestId('three-clearance')).toHaveValue('150')
    await expect(svg.locator('[data-3d-kind="clearance"]')).toHaveCount(3)
    await view.getByTestId('three-dimensions').uncheck()
    await expect(svg.locator('[data-3d-kind="clearance"]')).toHaveCount(0)
    await view.getByTestId('three-dimensions').check()
    await view.getByTestId('three-clearance').fill('200')
    await view.getByTestId('three-wallHeight').fill('2700')
    await view.getByTestId('three-obstacleHeight').fill('950')
    await view.getByTestId('three-baseHeight').fill('700')
    await view.getByTestId('three-ascentLengthMm').fill('1200')
    await view.getByTestId('three-descentLengthMm').fill('900')
    await expect(view.getByTestId('three-ramp-gradients')).toBeVisible()
    await expect(view.getByTestId('three-ramp-row').first()).toBeAttached()
    await view.getByTestId('three-walls').uncheck()
    await expect(svg.locator('[data-3d-kind="wall"]')).toHaveCount(0)
    await view.getByTestId('three-display-settings').locator('summary').click()
    await view.getByTestId('three-top').click()
    await expect(svg).toHaveAttribute('data-pitch', '90')
    const download = page.waitForEvent('download')
    await view.getByTestId('export-image-svg').click()
    const svgDownload = await download
    expect(svgDownload.suggestedFilename()).toContain('-3D.svg')
    const exportedSvg = fs.readFileSync(await svgDownload.path(), 'utf8')
    expect(exportedSvg).toContain('<svg')
    const pngDownload = page.waitForEvent('download')
    await view.getByTestId('export-image-png').click()
    const png = fs.readFileSync(await (await pngDownload).path())
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    saved = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/tracks\//.test(r.url()))
    await page.getByTestId('planner-save').click()
    const after = JSON.parse((await (await saved).json()).data.layout)
    expect(after.sceneHeights).toEqual({ wallHeight: 2700, obstacleHeight: 950, baseHeight: 700, clearance: 200 })
    expect(after.sceneRamps).toEqual({ ascentLengthMm: 1200, descentLengthMm: 900 })
    expect({ ...after, sceneHeights: undefined, sceneRamps: undefined }).toEqual({
      ...baseline,
      sceneHeights: undefined,
      sceneRamps: undefined,
    })
    await view.getByTestId('three-back-editor').click()
    await expect(page.getByTestId('graph-track-canvas')).toBeVisible()
    await page.getByTestId('toolbar-open-3d').click()
    await view.getByTestId('three-display-settings').locator('summary').click()
    await expect(view.getByTestId('three-clearance')).toHaveValue('200')
    await expect(view.getByTestId('three-wallHeight')).toHaveValue('2700')
    await expect(view.getByTestId('three-obstacleHeight')).toHaveValue('950')
    await expect(view.getByTestId('three-baseHeight')).toHaveValue('700')
    await expect(view.getByTestId('three-ascentLengthMm')).toHaveValue('1200')
    await expect(view.getByTestId('three-descentLengthMm')).toHaveValue('900')
    await view.getByTestId('three-display-settings').locator('summary').click()
    await page.reload()
    const rows = (await (await page.request.get('/api/tracks')).json()).data
    const row = rows.find((r) => r.name === '3D room ' + lang)
    await page.getByTestId('standalone-track').selectOption(row.id)
    await page.getByTestId('planner-mode').selectOption('3d')
    await view.getByTestId('three-display-settings').locator('summary').click()
    await expect(view.getByTestId('three-clearance')).toHaveValue('200')
    await expect(view.getByTestId('three-wallHeight')).toHaveValue('2700')
    await expect(view.getByTestId('three-obstacleHeight')).toHaveValue('950')
    await expect(view.getByTestId('three-baseHeight')).toHaveValue('700')
    await expect(view.getByTestId('three-ascentLengthMm')).toHaveValue('1200')
    await expect(view.getByTestId('three-descentLengthMm')).toHaveValue('900')
    expect(errors).toEqual([])
  })
test('3D viewer works without a saved room and keeps the canvas usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('planner-files-toggle').click()
  await page.getByTestId('track-plan-import').setInputFiles({
    name: 'without-room.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(source)),
  })
  await page.getByTestId('planner-mode').selectOption('3d')
  await expect(page.getByTestId('three-no-room')).toBeVisible()
  const svg = page.getByTestId('room-3d-canvas')
  await expect(svg).toBeVisible()
  const b = await svg.boundingBox()
  expect(b.height).toBeGreaterThan(100)
  expect(b.x + b.width).toBeLessThanOrEqual(391)
  expect(b.y + b.height).toBeLessThanOrEqual(845)
  await svg.focus()
  await svg.press('ArrowRight')
  await expect(svg).toHaveAttribute('data-yaw', '-30')
  await svg.press('0')
  await expect(svg).toHaveAttribute('data-yaw', '-35')
})

test('individual multi-stage heights save, reload, and restore the final flat rail', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('planner-files-toggle').click()
  await page.getByTestId('track-plan-import').setInputFiles({
    name: 'height-profile.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        ...source,
        pieces: Array.from({ length: 12 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
        pit: { ...source.pit, enabled: false },
        trackExtras: undefined,
        partGroups: undefined,
      }),
    ),
  })
  await page.locator('.planner-name').fill('Individual elevations')
  await page.getByTestId('planner-mode').selectOption('3d')
  const view = page.getByTestId('room-track-3d')
  await view.getByTestId('three-display-settings').locator('summary').click()
  for (const [rail, height, flat] of [
    [0, '0', false],
    [4, '200', true],
    [7, '350', true],
    [11, '0', true],
  ]) {
    await view.getByTestId('three-height-rail').selectOption(String(rail))
    await view.getByTestId('three-rail-height').fill(height)
    await view.getByTestId('three-rail-flat').setChecked(flat)
    await view.getByTestId('three-set-height').click()
  }
  await expect(view.getByTestId('three-height-point')).toHaveCount(4)
  await view.getByTestId('three-height-rail').selectOption('7')
  await view.getByTestId('three-display-settings').locator('summary').click()
  await page.getByTestId('room-3d-canvas').locator('path[data-3d-rail="11"][fill="#30363b"]').first().click()
  await view.getByTestId('three-display-settings').locator('summary').click()
  await expect(view.getByTestId('three-height-rail')).toHaveValue('11')
  await view.getByTestId('three-display-settings').locator('summary').click()
  await view.getByTestId('three-ramp-gradients').locator('summary').click()
  await expect(view.getByTestId('three-ramp-row')).toHaveCount(3)
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/tracks'))
  await page.getByTestId('planner-save').click()
  const row = (await (await saved).json()).data
  const plan = JSON.parse(row.layout)
  expect(plan.pieces[7].elevation).toEqual({ heightMm: 350, flat: true })
  await page.reload()
  await page.getByTestId('standalone-track').selectOption(row.id)
  await page.getByTestId('planner-mode').selectOption('3d')
  await view.getByTestId('three-display-settings').locator('summary').click()
  await view.getByTestId('three-height-rail').selectOption('11')
  await expect(view.getByTestId('three-rail-height')).toHaveValue('0')
  await expect(view.getByTestId('three-rail-flat')).toBeChecked()
  await view.getByTestId('three-height-rail').selectOption('7')
  await expect(view.getByTestId('three-rail-height')).toHaveValue('350')
  await view.getByTestId('three-remove-height').click()
  await expect(view.getByTestId('three-height-point')).toHaveCount(3)
  await view.getByTestId('three-display-settings').locator('summary').click()
  await view.getByTestId('three-back-editor').click()
  await page.getByTestId('track-undo').click()
  await page.getByTestId('toolbar-open-3d').click()
  await view.getByTestId('three-display-settings').locator('summary').click()
  await view.getByTestId('three-height-rail').selectOption('7')
  await expect(view.getByTestId('three-rail-height')).toHaveValue('350')
})

test('each bridge can store its own clear height', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('planner-files-toggle').click()
  await page
    .getByTestId('track-plan-import')
    .setInputFiles({ name: 'bridges.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) })
  await page.getByTestId('planner-mode').selectOption('3d')
  const view = page.getByTestId('room-track-3d')
  await view.getByTestId('three-display-settings').locator('summary').click()
  await view.getByTestId('three-height-rail').selectOption('33')
  await expect(view.getByTestId('three-local-clearance')).toHaveValue('150')
  await view.getByTestId('three-local-clearance').fill('200')
  await expect(view.getByTestId('three-local-clearance')).toHaveValue('200')
  await expect(view.getByTestId('three-rail-height')).toHaveValue('210')
  await view.getByTestId('three-height-rail').selectOption('36')
  await view.getByTestId('three-local-clearance').fill('300')
  await expect(view.getByTestId('three-local-clearance')).toHaveValue('300')
  await view.getByTestId('three-height-rail').selectOption('33')
  await expect(view.getByTestId('three-local-clearance')).toHaveValue('200')
})
