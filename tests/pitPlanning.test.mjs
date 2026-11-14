import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createPitLayout,
  distributePitPlaces,
  insertPitLayout,
} from '../addons/track-planner/src/components/pitPlanning.js'
import {
  emptyTrackPlan,
  enableFreePlacement,
  railRequirements,
  traceTrackPlan,
  validateTrackPlan,
  openTrackPorts,
  serializeTrackPlan,
  readTrackPlan,
} from '../vendor/racehubos/shared/src/index.js'
test('all 1–10 place distributions generate exactly the requested fuel places with connected main rails', () => {
  for (let places = 1; places <= 10; places++)
    for (let stops = 1; stops <= places; stops++)
      for (const parallel of [false, true]) {
        const plan = createPitLayout({ places, stops, parallel }),
          counts = railRequirements(plan)
        assert.equal(counts.counts['30361'], places)
        assert.equal(
          counts.counts['20517'],
          parallel ? distributePitPlaces(places, stops).reduce((n, v) => n + Math.ceil(v / 2), 0) : places,
        )
        assert.equal(counts.counts['30347'], 0)
        assert.equal(
          counts.counts['30356'],
          2 * (parallel ? distributePitPlaces(places, stops).reduce((n, v) => n + Math.ceil(v / 2), 0) : places),
        )
        assert.deepEqual(counts.unresolved, [])
        assert.equal(openTrackPorts(plan).length, 2)
        assert.equal(railRequirements(readTrackPlan(serializeTrackPlan(plan))).counts['30361'], places)
      }
})
test('forced lane change exchanges the two slots and preserves the 345mm footprint', () => {
  const plan = validateTrackPlan({
      ...emptyTrackPlan(),
      pieces: [{ type: 'Spurwechsel_20517', level: 0, jointDegrees: 0 }],
    }),
    s = traceTrackPlan(plan).segments[0]
  assert.deepEqual(s.points[1][0], [0, -49.5])
  assert.deepEqual(s.points[1].at(-1), [345, 49.5])
  assert.deepEqual(s.points[2][0], [0, 49.5])
  assert.deepEqual(s.points[2].at(-1), [345, -49.5])
  assert.equal(s.points[1].length, 33)
  assert.ok(s.laneLengthsM[0] > 0.345)
  assert.deepEqual(s.end, { x: 345, y: 0, h: 0 })
})
test('replacement preserves surrounding rails, height settings and connected endpoints in either direction', () => {
  const template = createPitLayout({ places: 5, distribution: [2, 3], parallel: true }),
    count = template.pieces.length
  const base = enableFreePlacement({
    ...emptyTrackPlan(),
    sceneRamps: { ascentLengthMm: 2000, descentLengthMm: 2000 },
    pieces: Array.from({ length: count + 4 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
  })
  for (const otherSide of [false, true]) {
    const updated = insertPitLayout(base, template, { placement: 'replace', selected: 2, otherSide })
    assert.equal(updated.pieces.length, base.pieces.length)
    assert.deepEqual(updated.pieces.slice(0, 2), base.pieces.slice(0, 2))
    assert.deepEqual(updated.pieces.slice(count + 2), base.pieces.slice(count + 2))
    assert.deepEqual(updated.sceneRamps, base.sceneRamps)
    assert.equal(openTrackPorts(updated).length, 2)
    assert.equal(railRequirements(updated).counts['30361'], 5)
  }
  assert.equal(railRequirements(base).counts['30361'], 0)
})
test('invalid inputs and protected replacements are rejected before changing the plan', () => {
  for (const places of [0, 11, 1.5, '', NaN]) assert.throws(() => createPitLayout({ places }), /configuration/)
  assert.throws(() => createPitLayout({ places: 5, distribution: [2, 2] }), /configuration/)
  const plan = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: Array.from({ length: 20 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
  })
  const template = createPitLayout({ places: 2 })
  assert.throws(() => insertPitLayout(plan, template, { placement: 'append' }), /openPort/)
  assert.throws(() => insertPitLayout(plan, template, { placement: 'replace', selected: 19 }), /straightSpace/)
  plan.pieces[0].borders = { left: {} }
  const before = JSON.stringify(plan)
  assert.throws(() => insertPitLayout(plan, template, { placement: 'replace', selected: 0 }), /protectedSpace/)
  assert.equal(JSON.stringify(plan), before)
})

import { encodeLegacyRoom, decodeLegacyRoom } from '../addons/track-planner/src/host/legacyBridge.js'
test('forced lane change survives old host storage without losing height or room metadata', () => {
  const plan = createPitLayout({ places: 4, stops: 2 })
  const encoded = encodeLegacyRoom(plan)
  assert.equal(encoded.pieces.filter((p) => p.type === 'Spurwechsel_20517').length, 0)
  const restored = decodeLegacyRoom(JSON.stringify(encoded))
  assert.equal(railRequirements(restored).counts['20517'], 4)
  assert.equal(railRequirements(restored).counts['30361'], 4)
  const bad = structuredClone(encoded)
  bad.pit.plannerExtraKindsV1.extras[0].index = -1
  assert.equal(decodeLegacyRoom(bad), null)
})

test('individual configured pit stops can be inserted into different straight sections', () => {
  const base = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: Array.from({ length: 60 }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
  })
  const first = insertPitLayout(base, createPitLayout({ places: 2 }), { placement: 'replace', selected: 1 })
  const second = insertPitLayout(first, createPitLayout({ places: 3 }), { placement: 'replace', selected: 30 })
  assert.equal(railRequirements(second).counts['30361'], 5)
  assert.equal(railRequirements(second).counts['30356'], 10)
  assert.equal(railRequirements(second).counts['20517'], 5)
  assert.deepEqual(second.pieces.slice(20, 30), base.pieces.slice(20, 30))
  assert.equal(openTrackPorts(second).length, 2)
})

import { independentPitAccess } from '../addons/track-planner/src/components/pitPlanning.js'
import { createPitAssembly } from '../vendor/racehubos/shared/src/index.js'
test('all places stay reachable with all other tank positions occupied', () => {
  for (const parallel of [false, true])
    for (let places = 1; places <= 10; places++) {
      const plan = createPitLayout({ places, parallel })
      assert.equal(independentPitAccess(plan), true)
    }
  // Regression: putting a second fuel rail after another on the same branch
  // must fail even when there is a forced lane change on the main track.
  const blocked = createPitAssembly({ bays: 1 })
  const singles = blocked.trackExtras.filter((e) => e.kind === 'single')
  singles[0].fuelBay = true
  singles[1].fuelBay = true
  assert.equal(independentPitAccess(blocked), false)
})

import { trackDrawItems } from '../vendor/racehubos/shared/src/index.js'
test('main track surfaces cannot overpaint the pit entry or exit slots in generated layouts', () => {
  for (const parallel of [false, true]) {
    const plan = createPitLayout({ places: 4, parallel })
    const items = trackDrawItems(plan, traceTrackPlan(plan).segments)
    const lastMain = items.reduce((n, item, i) => (item.drawKind === 'rail' ? i : n), -1)
    const switches = items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => ['pitEntry', 'pitExit'].includes(item.kind))
    assert.ok(lastMain >= 0)
    assert.equal(switches.length, 2 * railRequirements(plan).counts['30356'])
    assert.ok(switches.every(({ i }) => i > lastMain))
  }
})

test('fixed crossover is inside the pit after entry and before fuel rails, never replacing the pit entry', () => {
  const plan = createPitLayout({ places: 2, parallel: true, laneChange: true })
  assert.equal(plan.pieces[0].type, 'Pit_stop_weiche_anfang')
  assert.equal(plan.pieces.at(-1).type, 'Pit_stop_weiche_ende')
  assert.ok(plan.pieces.every((p) => p.type !== 'Spurwechsel_20517'))
  const cross = plan.trackExtras.filter((e) => e.kind === 'fixedCross')
  assert.equal(cross.length, 1)
  const x = cross[0].placement.xMm
  const fuel = plan.trackExtras.filter((e) => e.fuelBay)
  assert.equal(fuel.length, 2)
  assert.ok(fuel.every((e) => e.placement.xMm > x))
  assert.equal(railRequirements(plan).counts['30356'], 2)
  assert.equal(independentPitAccess(plan), true)
  const wire = encodeLegacyRoom(plan)
  assert.ok(wire.trackExtras.every((e) => e.kind !== 'fixedCross'))
  assert.equal(decodeLegacyRoom(wire).trackExtras.filter((e) => e.kind === 'fixedCross').length, 1)
})
