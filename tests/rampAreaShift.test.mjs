import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { shiftRampArea } from '../addons/track-planner/src/components/rampSuggestions.js'
import { buildTrackElevationModel } from '../addons/track-planner/src/components/trackElevationModel.js'
import { compatiblePorts, readTrackPlan, serializeTrackPlan } from '../vendor/racehubos/shared/src/index.js'
import { encodeLegacyRoom, decodeLegacyRoom } from '../addons/track-planner/src/host/legacyBridge.js'
const example = JSON.parse(
  fs.readFileSync(new URL('../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url)),
)
const source = () => ({ ...example, sceneRamps: { ascentLengthMm: 2000, descentLengthMm: 2000 } })
test('moving ascent and descent preserves ramp lengths, grade, crossing clearance and connected heights', () => {
  for (const [up, delta] of [
    [true, -100],
    [true, 100],
    [false, 100],
  ]) {
    const plan = source(),
      next = shiftRampArea(plan, up, delta)
    assert.ok(next)
    const a = buildTrackElevationModel(plan),
      b = buildTrackElevationModel(next)
    for (let i = 0; i < a.ramps.length; i++) {
      assert.equal(a.ramps[i].lengthMm, b.ramps[i].lengthMm)
      assert.equal(a.ramps[i].maxPercent, b.ramps[i].maxPercent)
    }
    assert.deepEqual(
      a.crossingMeasures.map((c) => c.clearanceMm),
      b.crossingMeasures.map((c) => c.clearanceMm),
    )
    for (const s of b.segments)
      for (const q of b.segments)
        if (
          s.index !== q.index &&
          compatiblePorts({ ...s.end, index: s.index }, { ...q.start, h: q.start.h + Math.PI, index: q.index })
        )
          assert.ok(Math.abs(b.heights[s.index].end - b.heights[q.index].start) < 1e-6)
    assert.deepEqual(decodeLegacyRoom(encodeLegacyRoom(next)).sceneRamps, next.sceneRamps)
    assert.deepEqual(readTrackPlan(serializeTrackPlan(next)).sceneRamps, next.sceneRamps)
  }
})
test('ramp movement respects limits, invalid input and manually pinned profiles', () => {
  let plan = source(),
    moves = 0
  while (moves < 500) {
    const next = shiftRampArea(plan, true, 100)
    if (!next) break
    plan = next
    moves++
  }
  assert.ok(moves > 0 && moves < 500)
  assert.equal(shiftRampArea(plan, true, 100), null)
  assert.equal(shiftRampArea(plan, true, NaN), null)
  const custom = source()
  custom.pieces = custom.pieces.map((p, i) => (i ? p : { ...p, elevation: { heightMm: 0, flat: true } }))
  assert.equal(shiftRampArea(custom, true, 100), null)
})

import { shiftRampAreaByParts } from '../addons/track-planner/src/components/rampSuggestions.js'
test('piece steps move the ramp start to the adjacent actual rail while retaining grade and length', () => {
  const plan = source(),
    next = shiftRampAreaByParts(plan, true, 1)
  assert.ok(next)
  const before = buildTrackElevationModel(plan).ramps.find((r) => r.up),
    after = buildTrackElevationModel(next).ramps.find((r) => r.up)
  const index = (r) =>
    r.chainBoundariesMm.findIndex(
      (p, i, a) => i < a.length - 1 && r.startAlongMm >= p - 1e-6 && r.startAlongMm < a[i + 1] - 1e-6,
    )
  assert.equal(index(after), index(before) + 1)
  assert.equal(before.lengthMm, after.lengthMm)
  assert.equal(before.maxPercent, after.maxPercent)
  const restored = shiftRampAreaByParts(next, true, -1)
  assert.ok(restored)
  assert.ok(
    Math.abs(buildTrackElevationModel(restored).ramps.find((r) => r.up).startAlongMm - before.startAlongMm) < 0.01,
  )
  assert.equal(shiftRampAreaByParts(plan, true, 1.5), null)
})
