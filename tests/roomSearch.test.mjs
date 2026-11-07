import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_ROOM,
  emptyTrackPlan,
  planRoom,
  traceTrackPlan,
  enableFreePlacement,
  validateTrackPlan,
} from '../vendor/racehubos/shared/src/index.js'
import {
  roomFitContext,
  roomPolygonsFit,
  fitTrackInRoom,
  trackRoomPolygons,
  roomSearchArea,
} from '../vendor/racehubos/shared/src/roomTrackFit.js'
import { placementCoordinates } from '../addons/track-planner/src/components/placementCoordinates.js'
const rect = (x, y, w, h) => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
]
const obstacle = (xM, yM, widthM, depthM) => ({ id: 'k', name: 'Kamin', kind: 'obstacle', xM, yM, widthM, depthM })
test('new mouse placements are finite, bounded and rounded without modifying input', () => {
  const p = { x: 123.456789, y: -0.0000001 }
  assert.deepEqual(placementCoordinates(p), { x: 123.457, y: 0 })
  assert.equal(p.x, 123.456789)
  assert.equal(placementCoordinates({ x: NaN, y: 1 }), null)
  assert.deepEqual(placementCoordinates({ x: 1e9, y: -1e9 }), { x: 990000, y: -990000 })
})
test('room checks entire surfaces, not only endpoints or the track bounding box', () => {
  const c = roomFitContext({ ...DEFAULT_ROOM, features: [obstacle(2, 1, 0.1, 0.1)] })
  assert.equal(roomPolygonsFit([rect(1500, 1000, 1000, 50)], c, 0, 0), false)
  assert.equal(roomPolygonsFit([rect(500, 500, 500, 50), rect(2800, 1800, 500, 50)], c, 0, 0), true)
})
test('obstacle wholly inside a track surface is detected', () => {
  const c = roomFitContext({ ...DEFAULT_ROOM, features: [obstacle(2, 1, 0.05, 0.05)] })
  assert.equal(roomPolygonsFit([rect(1700, 700, 800, 800)], c, 0, 0), false)
})
test('driver aisle and outer clearance remain reserved on every track level', () => {
  const c = roomFitContext(DEFAULT_ROOM)
  for (const r of [rect(500, 3200, 500, 100), rect(0, 500, 100, 100), rect(5900, 500, 200, 100)])
    assert.equal(roomPolygonsFit([r], c, 0, 0), false)
  assert.equal(roomPolygonsFit([rect(500, 500, 500, 100)], c, 0, 0), true)
})
test('concave room permits alcove but rejects missing corner and disconnected outside area', () => {
  const room = {
      ...DEFAULT_ROOM,
      features: [{ id: 'n', name: 'Nische', kind: 'extension', xM: 6, yM: 1, widthM: 2, depthM: 2 }],
    },
    c = roomFitContext(room)
  assert.equal(roomPolygonsFit([rect(6200, 1400, 1200, 500)], c, 0, 0), true)
  assert.equal(roomPolygonsFit([rect(6200, 400, 1200, 200)], c, 0, 0), false)
  assert.equal(roomSearchArea(room).width, 7700)
})
test('all surfaces include CU housing, shoulders and pit roads', () => {
  const p = planRoom(DEFAULT_ROOM).proposals[0].plan,
    polygons = trackRoomPolygons(p)
  assert.ok(polygons.length > p.pieces.length)
  assert.ok(polygons.some((poly) => poly.some((v) => v[1] < -99)))
})
test('placement finds a valid offset, retains CU geometry and survives native validation', () => {
  const p = { ...emptyTrackPlan(), pieces: [{ type: 'Control_unit', level: 0, jointDegrees: 0 }] },
    room = { ...DEFAULT_ROOM, features: [obstacle(2, 1, 2, 1)] },
    before = JSON.stringify(p),
    fit = fitTrackInRoom(p, room)
  assert.ok(fit)
  assert.equal(JSON.stringify(p), before)
  assert.equal(roomPolygonsFit(trackRoomPolygons(p), roomFitContext(room), fit.translation.x, fit.translation.y), true)
  assert.deepEqual(validateTrackPlan({ ...p, roomPlan: fit.room }).roomPlan, fit.room)
})
test('fully blocked floor produces no fitting placement or track proposal', () => {
  const room = {
    ...DEFAULT_ROOM,
    widthM: 2,
    depthM: 3,
    drivers: 1,
    driverWidthM: 0.4,
    features: [obstacle(0, 0, 2, 3)],
  }
  assert.equal(fitTrackInRoom({ ...emptyTrackPlan(), pieces: [{ type: 'Standardgerade', level: 0 }] }, room), null)
  assert.equal(planRoom(room).proposals.length, 0)
})
test('automatic search uses an extension that the base rectangle alone cannot fit', () => {
  const room = {
    ...DEFAULT_ROOM,
    widthM: 1.2,
    drivers: 1,
    driverWidthM: 0.4,
    features: [
      { id: 'n', name: 'Nische', kind: 'extension', xM: 1.2, yM: 0, widthM: 3, depthM: 3.2 },
      obstacle(0, 0, 0.6, 0.6),
    ],
  }
  assert.equal(planRoom({ ...room, features: [] }).proposals.length, 0)
  const result = planRoom(room)
  assert.ok(result.proposals.length)
  for (const p of result.proposals) {
    const origin = p.plan.roomPlan.backgroundOrigin
    assert.ok(origin)
    assert.equal(roomPolygonsFit(trackRoomPolygons(p.plan), roomFitContext(room), -origin.xMm, -origin.yMm), true)
    assert.ok(
      trackRoomPolygons(p.plan)
        .flat()
        .some((v) => v[0] - origin.xMm > 1200),
    )
    assert.ok(traceTrackPlan(p.plan).gapMm < 0.1)
  }
})

test('surface simplification preserves the complete road area and all corners', () => {
  const p = { ...emptyTrackPlan(), pieces: [{ type: 'Standardgerade', level: 0, jointDegrees: 0 }] },
    poly = trackRoomPolygons(p)[0],
    area =
      Math.abs(
        poly.reduce((sum, a, i) => {
          const b = poly[(i + 1) % poly.length]
          return sum + a[0] * b[1] - b[0] * a[1]
        }, 0),
      ) / 2
  assert.equal(poly.length, 4)
  assert.equal(area, 345 * 198)
})
