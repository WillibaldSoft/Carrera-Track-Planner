import { test, expect } from '@playwright/test'
import { emptyTrackPlan, enableFreePlacement, editFreeParts } from '../../vendor/racehubos/shared/src/index.js'
async function open(page, type = 'Standardgerade', fixture = null) {
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('planner-nav-files').click()
  await page.getByTestId('track-plan-import').setInputFiles({
    name: 'hover.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture ?? enableFreePlacement({ ...emptyTrackPlan(), pieces: [{ type, level: 0, jointDegrees: 0 }] }))),
  })
}
async function hoverRail(page, index) {
  const canvas = page.getByTestId('graph-track-canvas')
  await canvas.getByTestId(`rail-${index}`).hover()
  await expect(page.getByTestId('hover-track-actions')).toHaveAttribute('data-rail-index', String(index))
}
test('hover arrows extend both ways, attach each shoulder and support undo', async ({ page }) => {
  await open(page)
  const canvas = page.getByTestId('graph-track-canvas')
  await hoverRail(page, 0)
  await expect(page.locator('[data-hover-action]')).toHaveCount(4)
  await page.screenshot({ path: '/tmp/planner-hover-arrows.png' })
  await page.getByTestId('hover-track-left').click()
  await expect(page.getByTestId('hover-track-left')).toHaveAttribute('data-mode', 'remove')
  await page.getByTestId('hover-track-right').click()
  await expect(page.getByTestId('hover-track-right')).toHaveAttribute('data-mode', 'remove')
  await page.getByTestId('hover-track-forward').click()
  await expect(canvas).toHaveAttribute('data-piece-count', '2')
  await hoverRail(page, 0)
  await expect(page.getByTestId('hover-track-forward')).toHaveAttribute('aria-disabled', 'true')
  await page.getByTestId('hover-track-backward').click()
  await expect(canvas).toHaveAttribute('data-piece-count', '3')
  await page.getByTestId('track-undo').click()
  await expect(canvas).toHaveAttribute('data-piece-count', '2')
  await page.getByTestId('track-redo').click()
  await expect(canvas).toHaveAttribute('data-piece-count', '3')
})
test('curves extend backwards using a connected outgoing tangent', async ({ page }) => {
  await open(page, 'Kurve_1_60_rechts')
  await hoverRail(page, 0)
  await page.getByTestId('hover-track-backward').click()
  await expect(page.getByTestId('graph-track-canvas')).toHaveAttribute('data-piece-count', '2')
})
test('hover previews rails and shoulders without inserting; larger invisible hit area works', async ({ page }) => {
  await open(page)
  const canvas = page.getByTestId('graph-track-canvas')
  await hoverRail(page, 0)
  const undoDisabled = await page.getByTestId('track-undo').isDisabled()
  for (const action of ['forward', 'backward', 'left', 'right']) {
    await page.getByTestId(`hover-track-${action}`).hover()
    await expect(page.getByTestId('hover-action-preview')).toHaveAttribute('data-action', action)
    await expect(canvas).toHaveAttribute('data-piece-count', '1')
    expect(await page.getByTestId('track-undo').isDisabled()).toBe(undoDisabled)
  }
  await page.screenshot({ path: '/tmp/planner-hover-preview.png' })
  // Hit the transparent padding, beyond the unchanged visible arrow circle.
  const hit = await page.getByTestId('hover-track-hit-left').evaluate((el) => {
    const visible = el.nextElementSibling
    const svg = el.ownerSVGElement, p = svg.createSVGPoint()
    p.x = (Number(el.getAttribute('r')) + Number(visible.getAttribute('r'))) / 2; p.y = 0
    const q = p.matrixTransform(el.getScreenCTM()); return { x: q.x, y: q.y }
  })
  await page.mouse.move(hit.x, hit.y)
  await expect(page.getByTestId('hover-action-preview')).toHaveAttribute('data-action', 'left')
  await page.mouse.click(hit.x, hit.y)
  await expect(page.getByTestId('hover-track-left')).toHaveAttribute('data-mode', 'remove')
  await page.getByTestId('hover-track-left').hover()
  await expect(page.getByTestId('hover-action-preview')).toHaveAttribute('data-mode', 'remove')
  await expect(page.getByTestId('hover-action-unavailable')).toHaveCount(0)
  await expect(canvas).toHaveAttribute('data-piece-count', '1')
})

test('free rail inside old pit index interval has two usable shoulder arrows', async ({ page }) => {
  const base = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: Array.from({ length: 3 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
    pit: { ...emptyTrackPlan().pit, enabled: true, native: true, individualParts: true, entry: 0, merge: 2 },
    trackExtras: [{ kind: 'single', level: 0, paintOrder: 0, placement: { xMm: 172.5, yMm: 148.5, headingDegrees: 0 } }],
  })
  const added = editFreeParts(base, 0, 'after', ['Standardgerade'], { xMm: 2000, yMm: 2000, headingDegrees: 0 })
  await open(page, 'Standardgerade', added.plan)
  await hoverRail(page, added.selected)
  for (const side of ['left', 'right']) {
    await expect(page.getByTestId(`hover-track-${side}`)).toHaveAttribute('aria-disabled', 'false')
    await page.getByTestId(`hover-track-${side}`).hover()
    await expect(page.getByTestId('hover-action-preview')).toHaveAttribute('data-action', side)
    await page.getByTestId(`hover-track-${side}`).click()
    await expect(page.getByTestId(`hover-track-${side}`)).toHaveAttribute('data-mode', 'remove')
  }
  await expect(page.getByTestId('graph-track-canvas')).toHaveAttribute('data-piece-count', '4')
})

test('the same side arrow toggles shoulders with removal preview and undo/redo', async ({ page }) => {
  await open(page)
  await hoverRail(page, 0)
  const left = page.getByTestId('hover-track-left')
  await left.click()
  await expect(left).toHaveAttribute('data-mode', 'remove')
  await left.hover()
  await expect(page.getByTestId('hover-action-preview')).toHaveAttribute('data-mode', 'remove')
  await page.screenshot({ path: '/tmp/planner-shoulder-remove-preview.png' })
  await left.click()
  await expect(left).toHaveAttribute('data-mode', 'add')
  await page.getByTestId('track-undo').click()
  await hoverRail(page, 0)
  await expect(left).toHaveAttribute('data-mode', 'remove')
  await page.getByTestId('track-redo').click()
  await hoverRail(page, 0)
  await expect(left).toHaveAttribute('data-mode', 'add')
})
test('shoulder flow moves directly between adjacent side arrows without crossing a rail centre', async ({ page }) => {
  const fixture = enableFreePlacement({ ...emptyTrackPlan(), pieces: Array.from({ length: 4 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })) })
  await open(page, 'Standardgerade', fixture)
  await hoverRail(page, 0)
  await page.getByTestId('hover-track-left').click()
  for (const index of [1, 2, 3]) {
    const handle = page.locator(`[data-handle-key="${index}:left"]`)
    await expect(handle).toBeVisible()
    const box = await handle.boundingBox()
    // A straight pointer path stays beside the rails for the whole movement.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 })
    await expect(page.getByTestId('hover-track-actions')).toHaveAttribute('data-rail-index', String(index))
    await expect(page.getByTestId('hover-action-preview')).toHaveAttribute('data-mode', 'add')
    await handle.click()
    await expect(handle).toHaveAttribute('data-mode', 'remove')
  }
  await expect(page.getByTestId('graph-track-canvas')).toHaveAttribute('data-piece-count', '4')
  await page.screenshot({ path: '/tmp/planner-shoulder-flow.png' })
})
test('held side-arrow stroke adds/removes a run once, is one undo step, and Escape cancels', async ({ page }) => {
  const fixture = enableFreePlacement({ ...emptyTrackPlan(), pieces: Array.from({ length: 4 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })) })
  await open(page, 'Standardgerade', fixture)
  await hoverRail(page, 0)
  const handle = (index) => page.locator(`[data-handle-key="${index}:left"]`)
  const centre = async (index) => {
    const b = await handle(index).boundingBox()
    return { x: b.x+b.width/2, y: b.y+b.height/2 }
  }
  await page.evaluate(() => document.activeElement?.blur())
  const first = await centre(0)
  await page.mouse.move(first.x, first.y)
  await page.mouse.down()
  await expect(page.getByTestId('graph-track-canvas')).toBeFocused()
  for (const index of [1,2,3,2,1,0,1,2,3]) {
    const p = await centre(index)
    await page.mouse.move(p.x,p.y,{steps:10})
    await expect(handle(index)).toHaveAttribute('data-mode','remove')
  }
  await expect(page.getByTestId('shoulder-stroke-status')).toContainText('Randstreifen legen')
  await page.screenshot({ path: '/tmp/planner-shoulder-drag.png' })
  await page.mouse.move(50, 150)
  await page.mouse.up()
  await expect(page.getByTestId('shoulder-stroke-status')).toHaveCount(0)
  await page.getByTestId('track-undo').click()
  for (let index=0;index<4;index++) {
    await hoverRail(page,index)
    await expect(handle(index)).toHaveAttribute('data-mode','add')
  }
  await page.getByTestId('track-redo').click()
  await hoverRail(page,0)
  const again = await centre(0)
  await page.mouse.move(again.x,again.y)
  await page.mouse.down()
  for (const index of [1,2,3]) {
    const p=await centre(index);await page.mouse.move(p.x,p.y,{steps:8})
    await expect(handle(index)).toHaveAttribute('data-mode','add')
  }
  await page.mouse.up()
  await page.getByTestId('track-undo').click()
  await hoverRail(page,0)
  await expect(handle(0)).toHaveAttribute('data-mode','remove')
  const cancelStart=await centre(0)
  await page.mouse.move(cancelStart.x,cancelStart.y)
  await page.mouse.down()
  await expect(handle(0)).toHaveAttribute('data-mode','add')
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await hoverRail(page,0)
  await expect(handle(0)).toHaveAttribute('data-mode','remove')
  const blurStart=await centre(0)
  await page.mouse.move(blurStart.x,blurStart.y)
  await page.mouse.down()
  await expect(handle(0)).toHaveAttribute('data-mode','add')
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.mouse.up()
  await hoverRail(page,0)
  await expect(handle(0)).toHaveAttribute('data-mode','remove')
})
