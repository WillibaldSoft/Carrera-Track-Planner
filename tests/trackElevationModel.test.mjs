import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyTrackPlan,
  validateTrackPlan,
  readTrackPlan,
  enableFreePlacement,
} from '../vendor/racehubos/shared/src/index.js'
import {
  buildTrackElevationModel,
  applyRailGradient,
  gradientSpan,
  setRailElevation,
} from '../addons/track-planner/src/components/trackElevationModel.js'
import { buildRoomScene } from '../addons/track-planner/src/components/roomScene3d.js'
const p = () => ({
  ...emptyTrackPlan(),
  pieces: Array.from({ length: 5 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
})
test('2D metrics and 3D mesh use identical elevations and gradients', () => {
  let plan = setRailElevation(p(), 0, { heightMm: 0, flat: false })
  plan = setRailElevation(plan, 3, { heightMm: 160, flat: true })
  const model = buildTrackElevationModel(plan),
    scene = buildRoomScene(plan)
  for (const m of model.metrics) {
    const tops = scene.faces.filter((f) => f.rail === m.index && f.kind === 'track' && f.top)
    const zs = tops.flatMap((f) => f.points.map((q) => q[2] - 12))
    assert.ok(Math.abs(Math.min(...zs) - Math.min(m.startMm, m.endMm)) < 1e-6)
    assert.ok(Math.abs(Math.max(...zs) - Math.max(m.startMm, m.endMm)) < 1e-6)
  }
  assert.ok(model.metrics[1].meanPercent > 0)
  assert.ok(Math.abs(model.metrics[1].peakPercent) >= model.metrics[1].meanPercent)
})
test('slope entry creates native saved height points without changing XY geometry', () => {
  const plan = p(),
    model = buildTrackElevationModel(plan),
    next = applyRailGradient(plan, model, 0, 3, 10)
  assert.equal(next.pieces[0].elevation.flat, false)
  assert.equal(next.pieces[3].elevation.flat, true)
  assert.equal(next.pieces[3].elevation.heightMm, 103.5)
  const actual = gradientSpan(buildTrackElevationModel(next), 0, 3)
  assert.ok(Math.abs(actual.meanPercent - 10) < 1e-8)
  assert.deepEqual(readTrackPlan(JSON.stringify(next)).pieces[3].elevation, next.pieces[3].elevation)
  assert.deepEqual(
    next.pieces.map((q) => q.type),
    plan.pieces.map((q) => q.type),
  )
  assert.equal(plan.pieces[0].elevation, undefined)
})
test('descent, invalid bounds and disconnected spans are handled without mutation', () => {
  const plan = setRailElevation(p(), 0, { heightMm: 200, flat: false }),
    before = JSON.stringify(plan),
    model = buildTrackElevationModel(plan)
  const next = applyRailGradient(plan, model, 0, 2, -10)
  assert.equal(next.pieces[2].elevation.heightMm, 131)
  assert.throws(() => applyRailGradient(plan, model, 0, 2, -1000))
  assert.throws(() => applyRailGradient(plan, model, 0, 2, NaN))
  assert.throws(() => gradientSpan(model, 0, 0))
  const free = enableFreePlacement(p())
  free.pieces[1].placement.xMm += 3000
  assert.throws(() => gradientSpan(buildTrackElevationModel(free), 0, 2))
  assert.equal(JSON.stringify(plan), before)
})
test('label visibility persists independently from height values and rejects invalid flags', () => {
  const plan = setRailElevation(p(), 2, { heightMm: 150, flat: true })
  const shown = validateTrackPlan({ ...plan, showElevationLabels: true }),
    hidden = readTrackPlan(JSON.stringify({ ...shown, showElevationLabels: false }))
  assert.equal(hidden.showElevationLabels, false)
  assert.deepEqual(hidden.pieces, shown.pieces)
  assert.equal(validateTrackPlan(p()).showElevationLabels, undefined)
  assert.throws(() => validateTrackPlan({ ...plan, showElevationLabels: 'false' }))
})

test('2D clearance annotations and 3D dimensions share actual crossing measurements', async () => {
  const { readFile } = await import('node:fs/promises')
  const plan = JSON.parse(
    await readFile(new URL('../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url)),
  )
  plan.pieces[33].elevation = { heightMm: 210, flat: true }
  const model = buildTrackElevationModel(plan),
    scene = buildRoomScene(plan)
  assert.equal(model.metrics[33].clearanceMm, 200)
  assert.deepEqual(model.crossingMeasures, scene.crossingMeasures)
})
