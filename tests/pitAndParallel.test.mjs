import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyTrackPlan,
  enableFreePlacement,
  createPitAssembly,
  appendTrackTemplate,
  traceTrackPlan,
  extraWorldPose,
  freeTrackSelection,
  groupTrackParts,
  transformFreeParts,
  validateTrackPlan,
} from '../vendor/racehubos/shared/src/index.js'
import { prepareIndividualPitParts, updatePitPartWorld } from '../addons/track-planner/src/components/pitPartEditing.js'
import { parallelDockingPreview, dockingFrame } from '../addons/track-planner/src/components/parallelDocking.js'
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`)
const pose = (p, i) => extraWorldPose(p.trackExtras[i], traceTrackPlan(p).segments)
const rows = () =>
  transformFreeParts(
    enableFreePlacement({
      ...emptyTrackPlan(),
      pieces: Array.from({ length: 5 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
    }),
    [2, 3, 4],
    { degrees: 60, dx: 800, dy: 400 },
  )
test('pit groups are released once without moving CU, rails, extras or fuel bays', () => {
  const p = createPitAssembly({ includeCU: true }),
    poses = p.trackExtras.map((_, i) => pose(p, i)),
    r = prepareIndividualPitParts(p)
  assert.equal(r.partGroups.groups.length, 0)
  assert.deepEqual(r.pieces, p.pieces)
  r.pieces.forEach((_, i) => assert.deepEqual(freeTrackSelection(r, i), [i]))
  r.trackExtras.forEach((_, i) => assert.deepEqual(pose(r, i), poses[i]))
  assert.equal(r.trackExtras.filter((e) => e.fuelBay).length, 2)
  assert.strictEqual(prepareIndividualPitParts(r), r)
  const regrouped = groupTrackParts(r, [1, 3])
  assert.strictEqual(prepareIndividualPitParts(regrouped), regrouped)
  assert.equal(validateTrackPlan(JSON.parse(JSON.stringify(r))).pit.individualParts, true)
})
test('individual pit movement uses world coordinates under a rotated carrier and preserves neighbours', () => {
  const base = prepareIndividualPitParts(
    transformFreeParts(createPitAssembly({ includeCU: true }), [0, 1, 2, 3, 4, 5], { degrees: 90, dx: 300, dy: 500 }),
  )
  const i = base.trackExtras.findIndex((e) => e.kind === 'single'),
    old = pose(base, i),
    r = updatePitPartWorld(base, i, { xMm: old.xMm + 120, yMm: old.yMm - 50, headingDegrees: 25 })
  near(pose(r, i).xMm, old.xMm + 120)
  near(pose(r, i).yMm, old.yMm - 50)
  near(pose(r, i).headingDegrees, 25)
  assert.deepEqual(r.pieces, base.pieces)
  r.trackExtras.forEach((e, j) => {
    if (j !== i) assert.deepEqual(e, base.trackExtras[j])
  })
})
test('pit carrier changes preserve world pose, prevent phantom switches and retain AKS/fuel metadata', () => {
  let base = prepareIndividualPitParts(createPitAssembly({ includeCU: true }))
  const i = base.trackExtras.findIndex((e) => e.kind === 'pitEntry')
  base = { ...base, trackExtras: base.trackExtras.map((e, j) => (j === i ? { ...e, antiCollision: true } : e)) }
  const old = pose(base, i),
    r = updatePitPartWorld(base, i, { anchor: undefined })
  assert.equal(r.trackExtras[i].anchor, undefined)
  assert.deepEqual(pose(r, i), old)
  assert.equal(r.trackExtras[i].antiCollision, true)
  assert.equal(r.pieces[base.trackExtras[i].anchor].type, 'Standardgerade')
  const assigned = updatePitPartWorld(r, i, { anchor: 3 })
  assert.deepEqual(pose(assigned, i), old)
  const fuel = base.trackExtras.findIndex((e) => e.fuelBay),
    raised = updatePitPartWorld(base, fuel, { level: 1 })
  assert.equal(raised.trackExtras[fuel].anchor, undefined)
  assert.equal(raised.trackExtras[fuel].level, 1)
  assert.equal(raised.trackExtras[fuel].fuelBay, true)
})
test('parallel preview aligns a whole detached section at 198 mm and leaves the reference fixed', () => {
  const base = rows(),
    snapshot = JSON.stringify(base),
    r = parallelDockingPreview(base, { kind: 'rail', index: 0 }, { kind: 'rail', index: 3 }, { distanceMm: 198 })
  assert.equal(JSON.stringify(base), snapshot)
  assert.deepEqual(r.plan.pieces.slice(0, 2), base.pieces.slice(0, 2))
  assert.deepEqual(new Set(r.movingIndices), new Set([2, 3, 4]))
  const s = traceTrackPlan(r.plan).segments
  near(s[3].start.x, 0)
  near(s[3].start.y, 198)
  near(s[3].start.h, 0)
  near(s[2].end.x, s[3].start.x)
  near(s[4].start.x, s[3].end.x)
})
test('parallel docking supports custom distance, left and opposite direction without adding rails', () => {
  const base = rows(),
    r = parallelDockingPreview(
      base,
      { kind: 'rail', index: 0 },
      { kind: 'rail', index: 2 },
      { side: 'left', distanceMm: 123.5, opposite: true },
    )
  const b = dockingFrame(r.plan, { kind: 'rail', index: 2 })
  near(b.x, 0)
  near(b.y, -123.5)
  near(Math.abs(b.h), Math.PI)
  assert.equal(r.plan.pieces.length, 5)
})
test('a single pit rail docks beside CU at 148.5 mm independently of its neighbours', () => {
  const base = prepareIndividualPitParts(createPitAssembly({ includeCU: true })),
    i = base.trackExtras.findIndex((e) => e.kind === 'single')
  const r = parallelDockingPreview(base, { kind: 'rail', index: 2 }, { kind: 'extra', index: i }, { distanceMm: 148.5 })
  const frame = dockingFrame(r.plan, { kind: 'extra', index: i })
  near(frame.x, 690)
  near(frame.y, 148.5)
  assert.deepEqual(r.plan.pieces, base.pieces)
  base.trackExtras.forEach((e, j) => {
    if (j !== i) assert.deepEqual(r.plan.trackExtras[j], e)
  })
})
test('parallel docking protects CU, levels, shared carriers and connected sections', () => {
  const base = rows()
  assert.throws(
    () => parallelDockingPreview(base, { kind: 'rail', index: 0 }, { kind: 'rail', index: 1 }),
    /sameSection/,
  )
  const cu = { ...base, pieces: base.pieces.map((p, i) => (i === 3 ? { ...p, type: 'Control_unit' } : p)) }
  assert.throws(() => parallelDockingPreview(cu, { kind: 'rail', index: 0 }, { kind: 'rail', index: 3 }), /cuFixed/)
  const raised = { ...base, pieces: base.pieces.map((p, i) => (i >= 2 ? { ...p, level: 1 } : p)) }
  assert.throws(() => parallelDockingPreview(raised, { kind: 'rail', index: 0 }, { kind: 'rail', index: 2 }), /levels/)
  assert.throws(
    () => parallelDockingPreview(base, { kind: 'rail', index: 0 }, { kind: 'rail', index: 2 }, { distanceMm: 0 }),
    /distance/,
  )
})

test('matching R1/R2 curves dock concentrically for a four-lane section', () => {
  let base
  // R2 is supplied as two 30-degree modules by the catalogue.
  base = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: ['Kurve_1_60_rechts', 'Kurve_2_30_rechts', 'Kurve_2_30_rechts'].map((type) => ({
      type,
      level: 0,
      jointDegrees: 0,
    })),
  })
  base = transformFreeParts(base, [1, 2], { dx: 1000, dy: 900 })
  const r = parallelDockingPreview(
    base,
    { kind: 'rail', index: 0 },
    { kind: 'rail', index: 1 },
    { side: 'left', distanceMm: 198 },
  )
  const segments = traceTrackPlan(r.plan).segments
  near(segments[0].start.y + 299, segments[1].start.y + 497)
  near(segments[0].end.h, segments[2].end.h)
  near(Math.hypot(segments[0].end.x - segments[2].end.x, segments[0].end.y - segments[2].end.y), 198)
})

test('pit switch parallel docking preserves its driving orientation relative to CU', () => {
  const base = prepareIndividualPitParts(createPitAssembly({ includeCU: true })),
    i = base.trackExtras.findIndex((e) => e.kind === 'pitEntry')
  const r = parallelDockingPreview(base, { kind: 'rail', index: 2 }, { kind: 'extra', index: i }, { distanceMm: 198 })
  const f = dockingFrame(r.plan, { kind: 'extra', index: i })
  near(f.x, 690)
  near(f.y, 198)
  near(Math.sin(f.h), 0)
  near(Math.cos(f.h), 1)
  assert.deepEqual(r.plan.pieces[2], base.pieces[2])
})

test('two individual pit singles dock at 99 mm without moving carriers or other parts', () => {
  const base = prepareIndividualPitParts(createPitAssembly({ includeCU: true })),
    singles = base.trackExtras.flatMap((e, i) => (e.kind === 'single' ? [i] : []))
  const a = { kind: 'extra', index: singles[0] },
    b = { kind: 'extra', index: singles[1] },
    fixed = dockingFrame(base, a)
  const r = parallelDockingPreview(base, a, b, { distanceMm: 99 }),
    moved = dockingFrame(r.plan, b)
  near(moved.x, fixed.x)
  near(moved.y, fixed.y + 99)
  assert.deepEqual(r.plan.pieces, base.pieces)
  assert.deepEqual(r.plan.trackExtras[a.index], base.trackExtras[a.index])
})

test('new box templates are also released when inserted into an already migrated plan', () => {
  const base = prepareIndividualPitParts(createPitAssembly({ includeCU: true }))
  const appended = appendTrackTemplate(base, createPitAssembly(), { index: 5, end: 1 })
  const result = prepareIndividualPitParts(appended)
  assert.equal(result.pieces.length, 12)
  assert.equal(result.partGroups.groups.length, 0)
  for (let i = 0; i < 12; i++) assert.deepEqual(freeTrackSelection(result, i), [i])
  assert.equal(result.trackExtras.filter((e) => e.fuelBay).length, 4)
  assert.deepEqual(result.pieces[2], base.pieces[2])
})

test('legacy carrier AKS metadata transfers to its individual native switch', () => {
  const original = createPitAssembly({ includeCU: true }),
    base = { ...original, pieces: original.pieces.map((p, i) => (i === 0 ? { ...p, antiCollision: true } : p)) }
  const result = prepareIndividualPitParts(base)
  assert.equal(result.trackExtras.find((e) => e.kind === 'pitEntry' && e.placement.xMm === 172.5).antiCollision, true)
  assert.equal(result.pieces[0].antiCollision, undefined)
  assert.deepEqual(result.pieces[2], base.pieces[2])
})
