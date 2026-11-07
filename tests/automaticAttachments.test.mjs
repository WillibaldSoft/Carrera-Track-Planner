import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyTrackPlan,
  enableFreePlacement,
  transformFreeParts,
  railRequirements,
} from '../vendor/racehubos/shared/src/index.js'
import { attachmentOptions, attachTrackAccessory } from '../addons/track-planner/src/components/automaticAttachments.js'
import { selectedTrackBounds } from '../addons/track-planner/src/components/selectionViewport.js'
const straight = () => ({ ...emptyTrackPlan(), pieces: [{ type: 'Standardgerade', level: 0, jointDegrees: 0 }] })
test('automatic accessories match catalogue and add only the chosen side without mutation', () => {
  const p = straight(),
    before = JSON.stringify(p)
  assert.deepEqual(
    attachmentOptions(p, 0).map((o) => o.id),
    ['left', 'right'],
  )
  const next = attachTrackAccessory(p, 0, 'left')
  assert.equal(JSON.stringify(p), before)
  assert.ok(next.pieces[0].borders.left)
  assert.equal(next.pieces[0].borders.right, undefined)
  assert.equal(railRequirements(next).counts['20560'], 1)
  assert.deepEqual(
    attachmentOptions(next, 0).map((o) => o.id),
    ['left-startCap', 'left-endCap', 'right'],
  )
})
test('end pieces attach individually and existing opposite borders survive', () => {
  let p = attachTrackAccessory(straight(), 0, 'left')
  p = attachTrackAccessory(p, 0, 'right')
  p = attachTrackAccessory(p, 0, 'left-startCap')
  assert.ok(p.pieces[0].borders.left.startCap)
  assert.equal(p.pieces[0].borders.left.endCap, false)
  assert.ok(p.pieces[0].borders.right)
  assert.equal(railRequirements(p).counts['20598'], 1)
  assert.equal(attachTrackAccessory(p, 0, 'left-startCap'), p)
})
test('no end pieces offered on joined border ends and no suggestions for unsupported rails', () => {
  let p = { ...straight(), pieces: [...straight().pieces, ...straight().pieces] }
  for (const i of [0, 1]) p = attachTrackAccessory(p, i, 'left')
  assert.ok(!attachmentOptions(p, 0).some((o) => o.id === 'left-endCap'))
  assert.ok(!attachmentOptions(p, 1).some((o) => o.id === 'left-startCap'))
  assert.equal(attachmentOptions({ ...straight(), pieces: [{ type: 'Schikane_30373', level: 0 }] }, 0).length, 0)
})
test('pit-facing side is not offered and banked curves never get invalid end pieces', () => {
  const p = { ...straight(), pit: { ...straight().pit, enabled: true, entry: 0, merge: 0 } }
  assert.ok(!attachmentOptions(p, 0).some((o) => o.side === 'right'))
  let b = { ...straight(), pieces: [{ type: 'Steilkurve_1_30_links', level: 0, jointDegrees: 0 }] }
  b = attachTrackAccessory(b, 0, 'left')
  assert.ok(!attachmentOptions(b, 0).some((o) => o.kind !== 'strip'))
})
test('selection bounds isolate the chosen rail rather than the whole connected course', () => {
  const p = enableFreePlacement({ ...straight(), pieces: Array.from({ length: 5 }, () => straight().pieces[0]) }),
    before = JSON.stringify(p),
    b = selectedTrackBounds(p, [2])
  assert.equal(b.x, 690)
  assert.equal(b.width, 345)
  assert.equal(b.depth, 198)
  assert.equal(JSON.stringify(p), before)
  assert.equal(selectedTrackBounds(p, []), null)
})
test('selection bounds include CU housing, attached shoulders and free pit extras', () => {
  let p = { ...straight(), pieces: [{ type: 'Control_unit', level: 0, jointDegrees: 0 }] }
  const b = selectedTrackBounds(p, [0])
  assert.ok(b.y <= -238)
  p = attachTrackAccessory(p, 0, 'left')
  assert.ok(selectedTrackBounds(p, [0]).depth >= b.depth)
  p = {
    ...straight(),
    trackExtras: [
      { kind: 'single', level: 0, paintOrder: 0, placement: { xMm: 2000, yMm: 800, headingDegrees: 0 }, fuelBay: true },
    ],
  }
  const e = selectedTrackBounds(p, [], [0])
  assert.ok(e.x > 1700)
  assert.equal(e.depth, 99)
})

test('automatic suggestions keep the protruding CU and adapter housing clear', () => {
  for (const type of ['Control_unit', 'AdapterUnit']) {
    const p = { ...straight(), pieces: [{ type, level: 0, jointDegrees: 0 }] }
    assert.ok(!attachmentOptions(p, 0).some((o) => o.side === 'left'))
    assert.ok(attachmentOptions(p, 0).some((o) => o.side === 'right'))
  }
})

test('centring a carrier includes its attached extras while an individual extra stays independent', () => {
  const p = {
    ...straight(),
    trackExtras: [
      { kind: 'single', level: 0, paintOrder: 0, anchor: 0, placement: { xMm: 500, yMm: 300, headingDegrees: 0 } },
    ],
  }
  const carrier = selectedTrackBounds(p, [0]),
    single = selectedTrackBounds(p, [], [0])
  assert.equal(carrier.x, 0)
  assert.equal(carrier.width, 672.5)
  assert.equal(single.width, 345)
  assert.equal(single.depth, 99)
})
