import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyTrackPlan,
  enableFreePlacement,
  transformFreeParts,
  railRequirements,
  borderShapes,
  borderArtwork,
} from '../vendor/racehubos/shared/src/index.js'
import {
  attachmentOptions,
  attachTrackAccessory,
  attachAutomaticBorders,
  nextAutomaticBorderTarget,
  automaticBorderReversed,
} from '../addons/track-planner/src/components/automaticAttachments.js'
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

test('persistent side mode adds both sides atomically, preserves metadata and removes only newly joined caps', () => {
  let p = {
    ...straight(),
    pieces: [
      { ...straight().pieces[0], heightLabelOffset: { alongMm: 10, acrossMm: 20 } },
      { ...straight().pieces[0] },
    ],
  }
  p = attachTrackAccessory(p, 0, 'left')
  p = attachTrackAccessory(p, 0, 'left-endCap')
  p = attachTrackAccessory(p, 0, 'left-startCap')
  const before = JSON.stringify(p),
    next = attachAutomaticBorders(p, 1, 'both')
  assert.equal(JSON.stringify(p), before)
  assert.ok(next.pieces[1].borders.left && next.pieces[1].borders.right)
  assert.equal(next.pieces[0].borders.left.endCap, false)
  assert.equal(next.pieces[0].borders.left.startCap, true)
  assert.deepEqual(next.pieces[0].heightLabelOffset, p.pieces[0].heightLabelOffset)
  assert.equal(attachAutomaticBorders(next, 1, 'both'), next)
})
test('continuation follows physical connections, stops at splits and swaps side on a reversed rail', () => {
  const p = enableFreePlacement({ ...straight(), pieces: Array.from({ length: 3 }, () => straight().pieces[0]) })
  const reordered = { ...p, pieces: [p.pieces[0], p.pieces[2], p.pieces[1]] }
  assert.deepEqual(nextAutomaticBorderTarget(reordered, 0, 'left'), { index: 2, reverse: false })
  const split = {
    ...p,
    pieces: p.pieces.map((piece, i) => (i === 1 ? { ...piece, placement: { ...piece.placement, yMm: 500 } } : piece)),
  }
  assert.equal(nextAutomaticBorderTarget(split, 0, 'left'), null)
  const backwards = {
    ...p,
    pieces: [p.pieces[0], { ...p.pieces[1], placement: { xMm: 690, yMm: 0, headingDegrees: 180 } }],
  }
  assert.deepEqual(nextAutomaticBorderTarget(backwards, 0, 'left'), { index: 1, reverse: true })
  const laid = attachAutomaticBorders(backwards, 1, 'left', true)
  assert.ok(laid.pieces[1].borders.right)
  assert.equal(laid.pieces[1].borders.left, undefined)
  assert.equal(nextAutomaticBorderTarget(laid, 0, 'left'), null)
})
test('rotated and curved shoulders have their own narrow shape-following colour bands', () => {
  const p = attachAutomaticBorders(
    { ...straight(), pieces: [{ type: 'Kurve_1_60_links', level: 0, jointDegrees: 0 }] },
    0,
    'both',
  )
  const shapes = borderShapes(p),
    before = JSON.stringify(shapes)
  const inner = borderArtwork(shapes.find((s) => s.side === 'left')),
    outer = borderArtwork(shapes.find((s) => s.side === 'right'))
  assert.notEqual(inner.length, outer.length)
  assert.equal(inner.length - 1, 2)
  assert.equal(outer.length - 1, 10)
  for (const [patches, min, max] of [
    [inner, 100, 135],
    [outer, 463, 498],
  ])
    for (const patch of patches)
      for (const [x, y] of patch.points) {
        const r = Math.hypot(x, y + 299)
        assert.ok(r >= min && r <= max, `radius ${r}`)
      }
  assert.equal(JSON.stringify(shapes), before)
  const straightPlan = attachAutomaticBorders(straight(), 0, 'right'),
    parts = borderShapes(straightPlan)
  assert.equal(borderArtwork(parts[0]).length - 1, 6)
  for (const patch of borderArtwork(parts[0])) for (const [, y] of patch.points) assert.ok(y >= 165 && y <= 198)
  const rotated = transformFreeParts(enableFreePlacement(straightPlan), [0], { degrees: 180, dx: 0, dy: 0 })
  const a = borderArtwork(parts[0]),
    b = borderArtwork(borderShapes(rotated)[0])
  assert.equal(a.length, b.length)
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < a[i].points.length; j++) {
      assert.ok(Math.abs(a[i].points[j][0] + b[i].points[j][0]) < 1e-6)
      assert.ok(Math.abs(a[i].points[j][1] + b[i].points[j][1]) < 1e-6)
    }
})

test('automatic direction accepts legacy plans with no cached connectivity and empty drafts', () => {
  const legacy = straight()
  assert.equal(automaticBorderReversed(legacy, 0, null), false)
  assert.equal(automaticBorderReversed(emptyTrackPlan(), -1, null), false)
  const backwards = {
    ...enableFreePlacement(legacy),
    pieces: [
      { ...legacy.pieces[0], placement: { xMm: 0, yMm: 0, headingDegrees: 0 } },
      { ...legacy.pieces[0], placement: { xMm: 690, yMm: 0, headingDegrees: 180 } },
    ],
  }
  assert.equal(automaticBorderReversed(backwards, 1, null), true)
})
