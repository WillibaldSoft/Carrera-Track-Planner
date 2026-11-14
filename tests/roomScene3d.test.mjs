import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyTrackPlan,
  DEFAULT_ROOM,
  enableFreePlacement,
  traceTrackPlan,
} from '../vendor/racehubos/shared/src/index.js'
import { createStartPitPlan } from '../addons/track-planner/src/components/startPitPlan.js'
import {
  buildRoomScene,
  projectRoomScene,
  project3D,
  sceneTrackHeights,
  planeMatrix,
} from '../addons/track-planner/src/components/roomScene3d.js'
const room = {
  ...DEFAULT_ROOM,
  features: [
    { id: 'k', name: 'Kamin', kind: 'obstacle', xM: 0, yM: 0, widthM: 0.8, depthM: 0.6 },
    { id: 'n', name: 'Nische', kind: 'extension', xM: 6, yM: 1, widthM: 1, depthM: 2 },
  ],
  backgroundOrigin: { xMm: -3000, yMm: -1700 },
}
const p = () => ({ ...createStartPitPlan(emptyTrackPlan()), roomPlan: room })
test('3D model includes real room, alcove, obstacle, CU, roads and two fuel overlays without mutation', () => {
  const plan = p(),
    before = JSON.stringify(plan),
    s = buildRoomScene(plan)
  assert.equal(JSON.stringify(plan), before)
  assert.ok(s.faces.some((f) => f.kind === 'floor'))
  assert.ok(s.faces.some((f) => f.kind === 'wall'))
  assert.ok(s.faces.some((f) => f.kind === 'obstacle'))
  assert.ok(s.faces.some((f) => f.kind === 'unit'))
  assert.equal(s.art.filter((a) => a.kind === 'fuel').length, 2)
  assert.ok(
    s.faces
      .filter((f) => f.kind === 'floor')
      .flatMap((f) => f.points)
      .some((p) => p[0] === 4000),
  )
})
test('default upper deck has 150 mm clear space above lower rail plus 10 mm rail thickness', () => {
  const plan = enableFreePlacement({
      ...emptyTrackPlan(),
      pieces: [
        { type: 'Standardgerade', level: 0, jointDegrees: 0 },
        { type: 'Standardgerade', level: 1, jointDegrees: 0 },
      ],
    }),
    independent = {
      ...plan,
      pieces: plan.pieces.map((p, i) => ({ ...p, placement: { ...p.placement, xMm: i * 1000 } })),
    },
    s = buildRoomScene(independent)
  const lower = s.faces.find((f) => f.kind === 'track' && f.rail === 0 && f.top).points[0][2],
    upperBottom = s.faces.find((f) => f.kind === 'track' && f.rail === 1 && f.side).points[0][2]
  assert.equal(upperBottom - lower, 150)
  assert.equal(s.levelHeight, 160)
  assert.equal(s.clearance, 150)
})
test('view clearance and base height are configurable without editing source levels', () => {
  const plan = p(),
    before = JSON.stringify(plan),
    s = buildRoomScene(plan, { baseHeight: 750, clearance: 200 })
  assert.equal(s.levelHeight, 210)
  assert.equal(s.faces.find((f) => f.kind === 'track' && f.top).points[0][2], 762)
  assert.equal(JSON.stringify(plan), before)
})
test('nominal height interpolation joins connected rail endpoints and keeps CU flat', () => {
  const plan = {
      ...emptyTrackPlan(),
      pieces: [
        { type: 'Control_unit', level: 0 },
        { type: 'Standardgerade', level: 0 },
        { type: 'Standardgerade', level: 1 },
      ],
    },
    h = sceneTrackHeights(traceTrackPlan(plan).segments, 160)
  assert.equal(h[0].start, 0)
  assert.equal(h[0].end, 0)
  assert.equal(h[1].end, h[2].start)
})
test('orthographic projection responds to orbit and elevation with finite coordinates', () => {
  const a = project3D([200, 500, 160], { yaw: 0, pitch: 90 }),
    b = project3D([200, 500, 160], { yaw: 90, pitch: 30 })
  assert.equal(a.x, 200)
  assert.ok(Math.abs(a.y - 500) < 1e-8)
  assert.notEqual(a.x, b.x)
  assert.ok(Number.isFinite(b.depth))
  assert.ok(!planeMatrix(0, 0, 0, 12, { yaw: -35, pitch: 55 }, [0, 0]).includes('NaN'))
})
test('cutaway, wall and obstacle controls preserve geometry while changing visible faces', () => {
  const s = buildRoomScene(p()),
    camera = { yaw: -35, pitch: 55 },
    all = projectRoomScene(s, camera, { cutaway: false }),
    cut = projectRoomScene(s, camera),
    none = projectRoomScene(s, camera, { walls: false, obstacles: false })
  assert.ok(all.items.filter((f) => f.kind === 'wall').length > cut.items.filter((f) => f.kind === 'wall').length)
  assert.equal(none.items.filter((f) => f.kind === 'wall' || f.kind === 'obstacle').length, 0)
})
test('all 3D drawing depths and projected polygons remain finite in top and side views', () => {
  const s = buildRoomScene(p())
  for (const camera of [
    { yaw: -35, pitch: 55 },
    { yaw: 180, pitch: 15 },
    { yaw: 0, pitch: 90 },
  ]) {
    const projected = projectRoomScene(s, camera)
    assert.ok(projected.bounds.width > 0)
    for (const i of projected.items) {
      assert.ok(Number.isFinite(i.depth), i.id)
      for (const q of i.points || []) assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y))
    }
  }
})
test('a track without room is shown without inventing or assigning a room', () => {
  const plan = { ...emptyTrackPlan(), pieces: [{ type: 'Standardgerade', level: 0 }] },
    s = buildRoomScene(plan)
  assert.equal(s.hasRoom, false)
  assert.equal(plan.roomPlan, undefined)
  assert.equal(s.faces.filter((f) => f.kind === 'wall' || f.kind === 'floor').length, 0)
  assert.equal(buildRoomScene(emptyTrackPlan()).railCount, 0)
})

test('actual crossing rails preserve 150 mm clear height at every bridge', async () => {
  const { readFile } = await import('node:fs/promises')
  const fixture = JSON.parse(
    await readFile(new URL('../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url)),
  )
  const scene = buildRoomScene(fixture.plan ?? fixture)
  const dimensions = scene.lines.filter((l) => l.kind === 'clearance')
  assert.equal(dimensions.length, 3)
  for (const line of dimensions) assert.equal(line.points[1][2] - line.points[0][2], 150)
  for (const rail of [2, 33, 10, 36, 22, 38]) {
    const face = scene.faces.find((f) => f.kind === 'track' && f.top && f.rail === rail)
    assert.equal(new Set(face.points.map((p) => p[2])).size, 1)
  }
})

test('smooth ramps have flat ends, continuous height and a tessellated road surface', async () => {
  const { rampHeight } = await import('../addons/track-planner/src/components/roomScene3d.js')
  const h = { start: 0, end: 160 }
  assert.equal(rampHeight(h, 0), 0)
  assert.equal(rampHeight(h, 1), 160)
  assert.equal(rampHeight(h, 0.5), 80)
  assert.ok(rampHeight(h, 0.01) < 0.01)
  assert.ok(160 - rampHeight(h, 0.99) < 0.01)
  const plan = {
    ...emptyTrackPlan(),
    pieces: [
      { type: 'Standardgerade', level: 0 },
      { type: 'Standardgerade', level: 1 },
      { type: 'Standardgerade', level: 1 },
    ],
  }
  const scene = buildRoomScene(plan)
  const tops = scene.faces.filter((f) => f.kind === 'track' && f.rail === 0 && f.top)
  assert.equal(tops.length, 32)
  assert.ok(new Set(tops.flatMap((f) => f.points.map((p) => p[2]))).size > 20)
})
test('saved heights survive validation and JSON round trips; old plans retain defaults', async () => {
  const { validateTrackPlan, readTrackPlan, validateSceneHeights } =
    await import('../vendor/racehubos/shared/src/trackPlan.js')
  const settings = { wallHeight: 2800, obstacleHeight: 900, baseHeight: 750, clearance: 180 }
  const plan = validateTrackPlan({ ...p(), sceneHeights: settings })
  assert.deepEqual(readTrackPlan(JSON.stringify(plan)).sceneHeights, settings)
  assert.equal(buildRoomScene(plan).clearance, 180)
  assert.equal(buildRoomScene(p()).clearance, 150)
  for (const bad of [NaN, Infinity, -1, 501, '150'])
    assert.throws(() => validateSceneHeights({ ...settings, clearance: bad }))
})

test('orthographic top and side views preserve finite bounds and all rails', () => {
  const scene = buildRoomScene(p())
  for (const camera of [
    { yaw: 0, pitch: 90 },
    { yaw: 0, pitch: 0 },
    { yaw: 90, pitch: 0 },
  ]) {
    const projected = projectRoomScene(scene, camera, {
      walls: false,
      cutaway: true,
      obstacles: true,
      labels: true,
      dimensions: true,
    })
    assert.ok(Object.values(projected.bounds).every(Number.isFinite))
    assert.ok(projected.bounds.width > 0)
    assert.ok(projected.bounds.depth > 0)
  }
})

import { projectedTrackBounds } from '../addons/track-planner/src/components/roomScene3d.js'
import { trackViewport } from '../addons/track-planner/src/components/trackViewport.js'
test('centering fits every projected rail inside the actual canvas despite tall room walls', () => {
  const scene = buildRoomScene(p(), { wallHeight: 6000 })
  for (const camera of [
    { yaw: -35, pitch: 55 },
    { yaw: 0, pitch: 90 },
    { yaw: 0, pitch: 0 },
  ]) {
    const projected = projectRoomScene(scene, camera, {
      walls: true,
      cutaway: true,
      obstacles: true,
      labels: true,
      dimensions: true,
    })
    const bounds = projectedTrackBounds(projected)
    for (const viewport of [
      { width: 1200, height: 400 },
      { width: 350, height: 500 },
    ]) {
      const [x, y, w, h] = trackViewport(bounds, viewport, 1, { x: 0, y: 0 })
      const points = projected.items
        .filter((i) => i.rail !== undefined || i.extra !== undefined)
        .flatMap((i) => i.points || (i.point ? [i.point] : []))
      assert.ok(points.length > 0)
      for (const pt of points) assert.ok(pt.x >= x && pt.x <= x + w && pt.y >= y && pt.y <= y + h)
    }
  }
})
