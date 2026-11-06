import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyTrackPlan, enableFreePlacement, traceTrackPlan } from '../vendor/racehubos/shared/src/index.js'
import { replaceFollowingTrack } from '../addons/track-planner/src/components/followingTrackReplacement.js'
const curve = 'Kurve_1_60_rechts'
const loop = (tail = false) =>
  enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: (tail
      ? [
          'Control_unit',
          'Standardgerade',
          curve,
          curve,
          curve,
          'Standardgerade',
          'Standardgerade',
          'Standardgerade',
          curve,
          curve,
          curve,
          'Pit_stop_weiche_ende',
        ]
      : ['Control_unit', 'Standardgerade', curve, curve, curve, 'Standardgerade', 'Standardgerade', curve, curve, curve]
    ).map((type) => ({ type, level: 0, jointDegrees: 0 })),
  })
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`)
const same = (a, b) => {
  near(a.x, b.x)
  near(a.y, b.y)
}
test('closed-loop curve replacement follows CU driving direction and cuts immediately before the CU', () => {
  const base = loop(),
    snapshot = JSON.stringify(base),
    old = traceTrackPlan(base).segments
  assert.equal(traceTrackPlan(base).connectivity.closed, true)
  const r = replaceFollowingTrack(base, 3, ['Kurve_2_30_rechts']),
    s = traceTrackPlan(r.plan).segments
  assert.equal(r.stoppedAtCU, true)
  assert.equal(r.choices.at(-1).index, 9)
  assert.deepEqual(r.plan.pieces[0], base.pieces[0])
  assert.deepEqual(r.plan.pieces[1], base.pieces[1])
  assert.deepEqual(r.plan.pieces[2], base.pieces[2])
  for (let i = 4; i < s.length; i++) same(s[i].start, s[i - 1].end)
  same(s[3].start, old[3].start)
  assert.ok(Math.hypot(s[9].end.x - s[0].start.x, s[9].end.y - s[0].start.y) > 1)
  assert.equal(JSON.stringify(base), snapshot)
  assert.equal(traceTrackPlan(r.plan).connectivity.openPorts.length, 2)
  assert.ok(!r.moving.includes(0))
  assert.throws(() => replaceFollowingTrack(base, 3, ['Standardgerade'], r.count + 1), /cut point/)
})
test('the last ordinary rail before CU defines the cut; an intervening switch stays fixed', () => {
  const base = loop(true)
  assert.equal(traceTrackPlan(base).connectivity.closed, true)
  const r = replaceFollowingTrack(base, 3, ['Kurve_2_30_rechts'])
  assert.equal(r.choices.at(-1).index, 10)
  assert.deepEqual(r.plan.pieces[11], base.pieces[11])
  assert.deepEqual(r.plan.pieces[0], base.pieces[0])
})
test('reverse-stored curve keeps its incoming end and follows physical driving direction', () => {
  let base = loop(),
    old = traceTrackPlan(base).segments
  const end = old[3].end
  base = {
    ...base,
    pieces: base.pieces.map((p, i) =>
      i === 3
        ? {
            ...p,
            type: 'Kurve_1_60_links',
            placement: { xMm: end.x, yMm: end.y, headingDegrees: (((end.h * 180) / Math.PI + 180 + 180) % 360) - 180 },
          }
        : p,
    ),
  }
  assert.equal(traceTrackPlan(base).connectivity.closed, true)
  old = traceTrackPlan(base).segments
  const r = replaceFollowingTrack(base, 3, ['Kurve_2_30_links']),
    s = traceTrackPlan(r.plan).segments
  assert.equal(r.reverse, true)
  same(s[3].end, old[3].end)
  same(s[4].start, s[3].start)
  assert.deepEqual(r.plan.pieces[0], base.pieces[0])
})
test('open tracks stop at CU too, and an explicit cut never moves it', () => {
  const base = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: ['Standardgerade', 'Standardgerade', 'Control_unit', 'Standardgerade'].map((type) => ({
      type,
      level: 0,
      jointDegrees: 0,
    })),
  })
  const r = replaceFollowingTrack(base, 0, [curve])
  assert.deepEqual(r.moving, [1])
  assert.deepEqual(r.plan.pieces[2], base.pieces[2])
  assert.deepEqual(r.plan.pieces[3], base.pieces[3])
  assert.throws(() => replaceFollowingTrack(base, 2, [curve]), /cuProtected/)
})
test('CU anchor survives shuffled array order and keeps room and inventory-relevant metadata', () => {
  const original = loop(),
    order = [5, 8, 2, 0, 9, 1, 6, 3, 4, 7],
    base = { ...original, pieces: order.map((i) => original.pieces[i]) }
  const cu = order.indexOf(0),
    selected = order.indexOf(3),
    r = replaceFollowingTrack(base, selected, ['Kurve_2_30_rechts'])
  assert.deepEqual(r.plan.pieces[cu], base.pieces[cu])
  assert.equal(r.choices.at(-1).index, order.indexOf(9))
  assert.equal(r.plan.geometryProfile, base.geometryProfile)
})
