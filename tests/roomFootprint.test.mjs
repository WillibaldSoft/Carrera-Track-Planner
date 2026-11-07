import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_ROOM,
  validateRoom,
  emptyTrackPlan,
  readTrackPlan,
  enableFreePlacement,
  transformFreeParts,
  serializeTrackPlan,
} from '../vendor/racehubos/shared/src/index.js'
import { roomFootprint } from '../vendor/racehubos/shared/src/roomFootprint.js'
import {
  anchorRoom,
  withRoomAnchor,
  roomAndTrackBounds,
} from '../addons/track-planner/src/components/roomBackground.js'
const f = (id, kind, xM, yM, widthM = 1, depthM = 1) => ({ id, kind, name: id, xM, yM, widthM, depthM })
test('legacy rectangular room retains its dimensions and area', () => {
  const r = validateRoom(DEFAULT_ROOM)
  assert.equal(roomFootprint(r).areaM2, 30)
  assert.deepEqual(roomFootprint(r).bounds, { x: 0, y: 0, width: 6000, depth: 5000 })
})
test('alcove union and obstacle subtraction do not double count overlaps', () => {
  const r = validateRoom({
    ...DEFAULT_ROOM,
    features: [
      f('a', 'extension', 6, 1),
      f('b', 'extension', 6, 1.5),
      f('c', 'obstacle', 0, 0, 2, 1),
      f('d', 'obstacle', 1, 0, 2, 1),
    ],
  })
  assert.equal(roomFootprint(r).areaM2, 28.5)
})
test('left/top extensions support negative coordinates and connected chains', () => {
  const r = validateRoom({
    ...DEFAULT_ROOM,
    features: [f('a', 'extension', -1, 1), f('b', 'extension', -2, 1), f('c', 'extension', 2, -1)],
  })
  assert.deepEqual(roomFootprint(r).bounds, { x: -2000, y: -1000, width: 8000, depth: 6000 })
})
test('disconnected or corner-only additions and completely outside obstacles are rejected', () => {
  for (const item of [f('x', 'extension', 8, 0), f('x', 'extension', 6, 5), f('x', 'obstacle', 8, 0)])
    assert.throws(() => validateRoom({ ...DEFAULT_ROOM, features: [item] }))
})
test('finite positive dimensions, unique IDs and feature count are enforced', () => {
  for (const features of [
    [f('a', 'obstacle', 0, 0, 0)],
    [f('a', 'obstacle', NaN, 0)],
    [f('a', 'obstacle', 0, 0), f('a', 'obstacle', 1, 0)],
    Array.from({ length: 33 }, (_, i) => f('x' + i, 'obstacle', 0, 0)),
  ])
    assert.throws(() => validateRoom({ ...DEFAULT_ROOM, features }))
})
test('native track JSON round trip preserves features, names and fixed origin', () => {
  const plan = {
    ...emptyTrackPlan(),
    roomPlan: validateRoom({
      ...DEFAULT_ROOM,
      features: [{ ...f('k', 'obstacle', 0, 0), name: 'Kamin / cheminée' }],
      backgroundOrigin: { xMm: -123, yMm: 44 },
    }),
  }
  assert.deepEqual(readTrackPlan(serializeTrackPlan(plan)).roomPlan, plan.roomPlan)
})
test('room anchor is retained when track moves and does not allocate an anchored plan', () => {
  let p = withRoomAnchor(
    enableFreePlacement({
      ...emptyTrackPlan(),
      pieces: [{ type: 'Standardgerade', level: 0, jointDegrees: 0 }],
      roomPlan: { ...DEFAULT_ROOM },
    }),
  )
  const origin = p.roomPlan.backgroundOrigin
  assert.equal(withRoomAnchor(p), p)
  p = transformFreeParts(p, [0], { dx: 800, dy: 400, degrees: 30 })
  assert.deepEqual(anchorRoom(p.roomPlan, p).backgroundOrigin, origin)
})
test('fit bounds include full room extensions and rails outside room', () => {
  const plan = {
    ...emptyTrackPlan(),
    roomPlan: { ...DEFAULT_ROOM, features: [f('n', 'extension', 6, 1)], backgroundOrigin: { xMm: 0, yMm: 0 } },
  }
  assert.deepEqual(roomAndTrackBounds(plan, { x: -500, y: -300, width: 1000, depth: 600 }), {
    x: -500,
    y: -300,
    width: 7500,
    depth: 5300,
  })
})

import { encodeLegacyRoom, decodeLegacyRoom } from '../addons/track-planner/src/host/legacyBridge.js'
test('legacy host can strip room fields without losing the adapter snapshot', () => {
  const plan = {
    ...emptyTrackPlan(),
    roomPlan: {
      ...DEFAULT_ROOM,
      features: [f('k', 'obstacle', 0, 0), f('n', 'extension', 6, 1)],
      backgroundOrigin: { xMm: -800, yMm: -900 },
    },
  }
  const wire = encodeLegacyRoom(plan)
  assert.equal(plan.pit.plannerRoomV1, undefined)
  const oldHost = { ...wire, roomPlan: { ...DEFAULT_ROOM } }
  assert.deepEqual(decodeLegacyRoom(oldHost).roomPlan, plan.roomPlan)
  assert.deepEqual(decodeLegacyRoom(JSON.stringify(oldHost)).roomPlan, plan.roomPlan)
  assert.equal(decodeLegacyRoom(oldHost).pit.plannerRoomV1, undefined)
  assert.equal(
    decodeLegacyRoom({
      ...oldHost,
      pit: { ...oldHost.pit, plannerRoomV1: { ...plan.roomPlan, features: [f('bad', 'extension', 20, 20)] } },
    }),
    null,
  )
})
