import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyTrackPlan, readTrackPlan, validateTrackPlan } from '../vendor/racehubos/shared/src/trackPlan.js'
import { enableFreePlacement } from '../vendor/racehubos/shared/src/index.js'
import { buildTrackElevationModel } from '../addons/track-planner/src/components/trackElevationModel.js'
import { layoutTrackHeightLabels } from '../addons/track-planner/src/components/heightLabelLayout.js'
import {
  manualLabelWorldCenter,
  labelOffsetFromScreen,
  setHeightLabelOffset,
  resetHeightLabelOffsets,
} from '../addons/track-planner/src/components/manualHeightLabels.js'
const p = () => ({
  ...emptyTrackPlan(),
  pieces: Array.from({ length: 3 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
})
const view = { box: [-200, -800, 1600, 1000], viewport: { width: 960, height: 600 } }
test('manual positions survive native validation and JSON; invalid coordinates are rejected', () => {
  const plan = p(),
    next = setHeightLabelOffset(plan, 1, { alongMm: 120.5, acrossMm: -400 })
  assert.deepEqual(readTrackPlan(JSON.stringify(next)).pieces[1].heightLabelOffset, { alongMm: 120.5, acrossMm: -400 })
  assert.equal(plan.pieces[1].heightLabelOffset, undefined)
  assert.equal(validateTrackPlan(plan).pieces[1].heightLabelOffset, undefined)
  for (const bad of [
    null,
    [],
    { alongMm: NaN, acrossMm: 0 },
    { alongMm: 0, acrossMm: Infinity },
    { alongMm: 1000001, acrossMm: 0 },
    { alongMm: '2', acrossMm: 0 },
  ])
    assert.throws(() => validateTrackPlan({ ...plan, pieces: [{ ...plan.pieces[0], heightLabelOffset: bad }] }))
})
test('rail-local coordinates round trip through screen space and follow rotated rails', () => {
  const plan = p(),
    model = buildTrackElevationModel(plan),
    offset = { alongMm: 80, acrossMm: -200 }
  const world = manualLabelWorldCenter(model.segments[0], offset)
  const layout = { origin: [-200, -800], unitX: 1600 / 960, unitY: 1000 / 600 }
  assert.deepEqual(
    labelOffsetFromScreen(model, layout, 0, { x: (world[0] + 200) / layout.unitX, y: (world[1] + 800) / layout.unitY }),
    offset,
  )
  const free = enableFreePlacement({ ...plan, pieces: [plan.pieces[0]] })
  free.pieces[0].placement.headingDegrees = 90
  const rotated = manualLabelWorldCenter(buildTrackElevationModel(free).segments[0], offset)
  assert.ok(Math.abs(rotated[0] + world[1]) < 1e-6)
  assert.ok(Math.abs(rotated[1] - world[0]) < 1e-6)
})
test('saved manual cards reserve space; a colliding drag relocates only its preview', () => {
  let plan = setHeightLabelOffset(p(), 0, { alongMm: 0, acrossMm: -500 })
  plan = setHeightLabelOffset(plan, 1, { alongMm: 0, acrossMm: -500 })
  const before = JSON.stringify(plan),
    model = buildTrackElevationModel(plan),
    layout = layoutTrackHeightLabels({ ...view, model, plan })
  const first = layout.items.find((c) => c.index === 0),
    second = layout.items.find((c) => c.index === 1)
  assert.ok(first.manual && !first.adjusted)
  assert.ok(second.manual && !second.adjusted)
  const moved = layoutTrackHeightLabels({
    ...view,
    model,
    plan,
    preview: { index: 0, offset: { alongMm: 345, acrossMm: -500 }, fallbackRect: first.rect },
  })
  assert.deepEqual(moved.items.find((c) => c.index === 1).rect, second.rect)
  const a = moved.items.find((c) => c.index === 0).rect,
    b = second.rect
  assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y)
  assert.equal(JSON.stringify(plan), before)
})
test('single and global automatic reset remove only label positions and preserve height data', () => {
  let plan = p()
  plan.pieces[1].elevation = { heightMm: 180, flat: true }
  plan = setHeightLabelOffset(setHeightLabelOffset(plan, 0, { alongMm: 20, acrossMm: 300 }), 1, {
    alongMm: 0,
    acrossMm: -500,
  })
  const single = resetHeightLabelOffsets(plan, 0)
  assert.equal(single.pieces[0].heightLabelOffset, undefined)
  assert.ok(single.pieces[1].heightLabelOffset)
  const all = resetHeightLabelOffsets(plan)
  assert.ok(all.pieces.every((q) => !q.heightLabelOffset))
  assert.deepEqual(all.pieces[1].elevation, plan.pieces[1].elevation)
  assert.deepEqual(
    all.pieces.map((q) => ({ type: q.type, level: q.level, jointDegrees: q.jointDegrees })),
    p().pieces,
  )
})
