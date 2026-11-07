import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyTrackPlan,
  editTrackPieces,
  traceTrackPlan,
  extraWorldPose,
  validateTrackPlan,
} from '../vendor/racehubos/shared/src/index.js'
import { attachInsertedBorders } from '../addons/track-planner/src/components/automaticAttachments.js'
import {
  repeatedTrackPreview,
  placeRepeatedTrackPart,
} from '../addons/track-planner/src/components/repeatTrackPlacement.js'
import { pitShoulderOptions, attachPitShoulder } from '../addons/track-planner/src/components/pitShoulders.js'
import { updatePitPartWorld } from '../addons/track-planner/src/components/pitPartEditing.js'
for (const side of ['left', 'right', 'both'])
  test(`new rails and repeated placement retain ${side} shoulders`, () => {
    let plan = emptyTrackPlan()
    const first = editTrackPieces(plan, -1, 'after', ['Standardgerade'])
    plan = attachInsertedBorders(first.plan, first.selected, 1, side)
    const previous = JSON.stringify(plan.pieces[0].borders)
    for (let n = 0; n < 3; n++) {
      const preview = repeatedTrackPreview(
        plan,
        ['Standardgerade'],
        { x: 1000 + n * 500, y: 500 },
        { snap: false, borderSide: side },
      )
      assert.equal(!!preview.plan.pieces[0].borders.left, side !== 'right')
      const result = placeRepeatedTrackPart(plan, ['Standardgerade'], preview, side)
      assert.equal(result.placed, true)
      const p = result.plan.pieces[result.selected]
      assert.equal(!!p.borders.left, side !== 'right')
      assert.equal(!!p.borders.right, side !== 'left')
      assert.equal(JSON.stringify(result.plan.pieces[0].borders), previous)
      plan = result.plan
    }
  })
test('disabled insertion leaves rails bare; multi-module insertion decorates its full range', () => {
  const r = editTrackPieces(emptyTrackPlan(), -1, 'after', ['Standardgerade', 'Standardgerade'])
  assert.equal(attachInsertedBorders(r.plan, 0, 2, 'none'), r.plan)
  assert.ok(attachInsertedBorders(r.plan, 0, 2, 'both').pieces.every((p) => p.borders.left && p.borders.right))
})
for (const kind of ['single', 'pitEntry', 'pitExit'])
  test(`pit ${kind} shoulder attaches once, persists and follows coordinates/rotation`, () => {
    let p = validateTrackPlan({
      ...emptyTrackPlan(),
      pieces: [{ type: 'Standardgerade', level: 0, jointDegrees: 0 }],
      trackExtras: [{ kind, level: 0, paintOrder: 0, placement: { xMm: 800, yMm: 500, headingDegrees: 0 } }],
    })
    const options = pitShoulderOptions(p, 0)
    assert.equal(options.length, kind === 'single' ? 2 : 1)
    const side = options.at(-1).side
    p = attachPitShoulder(p, 0, side)
    assert.equal(p.trackExtras.length, 2)
    assert.equal(attachPitShoulder(p, 0, side), p)
    p = validateTrackPlan(JSON.parse(JSON.stringify(p)))
    const moved = updatePitPartWorld(p, 0, { xMm: 1000, yMm: 700, headingDegrees: 90 })
    const world = extraWorldPose(moved.trackExtras[1], traceTrackPlan(moved).segments)
    assert.ok(Math.abs(world.xMm - 1099) < 0.001)
    assert.ok(Math.abs(world.yMm - 700) < 0.001)
    assert.equal(
      pitShoulderOptions(moved, 0).some((o) => o.side === side),
      false,
    )
  })
