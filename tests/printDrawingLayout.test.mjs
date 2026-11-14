import test from 'node:test'
import assert from 'node:assert/strict'
import { printDrawingBox } from '../addons/track-planner/src/components/printDrawingLayout.js'
test('printing keeps an offset room and track centered when rotated', () => {
  const bounds = { x: -2300, y: 750, width: 6000, depth: 3500 }
  const normal = printDrawingBox(bounds, 0),
    rotated = printDrawingBox(bounds, 90)
  assert.deepEqual(normal.center, [700, 2500])
  assert.deepEqual(rotated.center, normal.center)
  assert.ok(Math.abs(rotated.box[2] - normal.box[3]) < 1e-8)
  assert.ok(Math.abs(rotated.box[3] - normal.box[2]) < 1e-8)
  for (const angle of [0, 90, 180, 270]) {
    const { box, center } = printDrawingBox(bounds, angle)
    for (const x of [bounds.x, bounds.x + bounds.width])
      for (const y of [bounds.y, bounds.y + bounds.depth]) {
        const r = (angle * Math.PI) / 180,
          dx = x - center[0],
          dy = y - center[1]
        const px = center[0] + dx * Math.cos(r) - dy * Math.sin(r),
          py = center[1] + dx * Math.sin(r) + dy * Math.cos(r)
        assert.ok(px >= box[0] && px <= box[0] + box[2] && py >= box[1] && py <= box[1] + box[3])
      }
  }
})
