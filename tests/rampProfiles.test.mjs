import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyTrackPlan,
  traceTrackPlan,
  validateTrackPlan,
  readTrackPlan,
} from '../vendor/racehubos/shared/src/trackPlan.js'
import { buildRampProfiles } from '../addons/track-planner/src/components/rampProfiles.js'
const plan = () => ({
  ...emptyTrackPlan(),
  pieces: Array.from({ length: 12 }, (_, i) => ({ type: 'Standardgerade', level: i < 6 ? 0 : 1 })),
})
test('configured ramp length changes actual profile and computes mean and peak gradients', () => {
  const s = traceTrackPlan(plan()).segments
  const a = buildRampProfiles(s, { ascentLengthMm: 1000, descentLengthMm: 800 })
  const b = buildRampProfiles(s, { ascentLengthMm: 2000, descentLengthMm: 800 })
  assert.equal(a.ramps[0].lengthMm, 1000)
  assert.equal(a.ramps[0].meanPercent, 16)
  assert.equal(a.ramps[0].maxPercent, 30)
  assert.equal(b.ramps[0].meanPercent, 8)
  assert.notEqual(a.profiles[5].sample(0), b.profiles[5].sample(0))
  for (let i = 0; i < s.length - 1; i++) assert.ok(Math.abs(a.profiles[i].end - a.profiles[i + 1].start) < 1e-8)
})
test('descent uses its own length and long ramps report restricted space while preserving crossing plateaus', () => {
  const p = plan()
  p.pieces.forEach((q) => (q.level = 1 - q.level))
  const s = traceTrackPlan(p).segments
  const a = buildRampProfiles(s, { ascentLengthMm: 1000, descentLengthMm: 600 })
  assert.equal(a.ramps[0].lengthMm, 600)
  assert.equal(a.ramps[0].up, false)
  const b = buildRampProfiles(s, { ascentLengthMm: 20000, descentLengthMm: 20000 }, 160, 0, new Set([4, 7]))
  assert.equal(b.ramps[0].clipped, true)
  assert.equal(b.profiles[4].start, 160)
  assert.equal(b.profiles[4].end, 160)
  assert.equal(b.profiles[7].start, 0)
  assert.equal(b.profiles[7].end, 0)
})
test('native validation saves ramp settings and rejects invalid values without changing old plans', () => {
  const p = plan(),
    r = { ascentLengthMm: 1200, descentLengthMm: 900 }
  assert.deepEqual(readTrackPlan(JSON.stringify(validateTrackPlan({ ...p, sceneRamps: r }))).sceneRamps, r)
  assert.equal(validateTrackPlan(p).sceneRamps, undefined)
  for (const bad of [-1, 0, 99, 20001, NaN, Infinity, '1000'])
    assert.throws(() => validateTrackPlan({ ...p, sceneRamps: { ...r, ascentLengthMm: bad } }))
})

test('saved lengths drive the rendered road geometry without altering XY coordinates', async () => {
  const { buildRoomScene } = await import('../addons/track-planner/src/components/roomScene3d.js')
  const p = plan(),
    before = JSON.stringify(p)
  const a = buildRoomScene({ ...p, sceneRamps: { ascentLengthMm: 1000, descentLengthMm: 800 } })
  const b = buildRoomScene({ ...p, sceneRamps: { ascentLengthMm: 2000, descentLengthMm: 800 } })
  assert.equal(a.ramps[0].lengthMm, 1000)
  assert.notDeepEqual(
    a.faces.filter((f) => f.rail === 4),
    b.faces.filter((f) => f.rail === 4),
  )
  assert.equal(JSON.stringify(p), before)
})

test('real course with small joint adjustments has both ascent and descent and keeps crossing heights', async () => {
  const { readFile } = await import('node:fs/promises')
  const { buildRoomScene } = await import('../addons/track-planner/src/components/roomScene3d.js')
  const p = JSON.parse(
    await readFile(new URL('../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url)),
  )
  const scene = buildRoomScene({ ...p, sceneRamps: { ascentLengthMm: 1000, descentLengthMm: 1000 } })
  assert.ok(scene.ramps.some((r) => r.up))
  assert.ok(scene.ramps.some((r) => !r.up))
  for (const rail of [2, 33, 10, 36, 22, 38]) {
    const tops = scene.faces.filter((f) => f.kind === 'track' && f.top && f.rail === rail)
    const expected = (p.pieces[rail].level ?? 0) * 160 + 12
    for (const f of tops) for (const point of f.points) assert.ok(Math.abs(point[2] - expected) < 1e-6)
  }
})

test('individual rail heights create multi-stage ramps with a final flat rail and survive save', async () => {
  const { buildRoomScene } = await import('../addons/track-planner/src/components/roomScene3d.js')
  const p = plan()
  p.pieces.forEach((q) => (q.level = 0))
  for (const [index, heightMm, flat] of [
    [0, 0, false],
    [4, 200, true],
    [7, 350, true],
    [11, 0, true],
  ])
    p.pieces[index].elevation = { heightMm, flat }
  const saved = readTrackPlan(JSON.stringify(validateTrackPlan(p)))
  assert.deepEqual(saved.pieces[7].elevation, { heightMm: 350, flat: true })
  const s = traceTrackPlan(saved).segments,
    anchors = new Map(saved.pieces.flatMap((p, i) => (p.elevation ? [[i, p.elevation]] : [])))
  const model = buildRampProfiles(s, undefined, 160, 0, new Set(), anchors)
  assert.equal(model.ramps.length, 3)
  for (const [index, height] of [
    [4, 200],
    [7, 350],
    [11, 0],
  ]) {
    assert.equal(model.profiles[index].start, height)
    assert.equal(model.profiles[index].end, height)
  }
  assert.ok(model.profiles[1].sample(0.5) > 0)
  for (let i = 0; i < s.length - 1; i++) assert.ok(Math.abs(model.profiles[i].end - model.profiles[i + 1].start) < 1e-6)
  assert.equal(buildRoomScene(saved).ramps.length, 3)
  for (const bad of [-1, 3001, NaN, '200'])
    assert.throws(() =>
      validateTrackPlan({ ...p, pieces: [{ ...p.pieces[0], elevation: { heightMm: bad, flat: true } }] }),
    )
})

test('crossing clearance follows individual heights even on rails with the same legacy level', async () => {
  const { readFile } = await import('node:fs/promises')
  const { buildRoomScene } = await import('../addons/track-planner/src/components/roomScene3d.js')
  const p = JSON.parse(
    await readFile(new URL('../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url)),
  )
  p.pieces.forEach((q) => (q.level = 0))
  p.pieces[33].elevation = { heightMm: 210, flat: true }
  const scene = buildRoomScene(p)
  const crossing = scene.lines.find((l) => l.id === 'clearance-0')
  assert.ok(crossing)
  assert.ok(scene.lines.some((l) => l.kind === 'clearance' && Math.abs(l.points[1][2] - l.points[0][2] - 200) < 1e-6))
})

test('legacy plans automatically use continuous smooth ramps at level changes', async () => {
  const { buildTrackElevationModel } = await import('../addons/track-planner/src/components/trackElevationModel.js')
  const p = plan()
  const model = buildTrackElevationModel(p)
  assert.ok(model.ramps.length > 0)
  assert.equal(p.sceneRamps, undefined)
  for (let i = 0; i < model.heights.length - 1; i++)
    assert.ok(Math.abs(model.heights[i].end - model.heights[i + 1].start) < 1e-8)
  assert.ok(model.heights.some((h) => h.sloped))
})

test('ramps cross the same submillimetre joints accepted by the editor', async () => {
  const { suggestRampLengths } = await import('../addons/track-planner/src/components/rampSuggestions.js')
  const p = plan()
  p.pieces.forEach((q) => {
    q.level = 1 - q.level
  })
  const segments = traceTrackPlan(p).segments
  // A small imported placement adjustment must not split the descent chain.
  for (const s of segments.slice(7)) {
    s.start.x += 0.264
    s.end.x += 0.264
    s.points = s.points.map((lane) => lane.map(([x, y]) => [x + 0.264, y]))
  }
  const model = buildRampProfiles(segments, { ascentLengthMm: 1000, descentLengthMm: 2000 })
  assert.equal(model.ramps[0].lengthMm, 2000)
  assert.equal(model.ramps[0].maxPercent, 15)
  assert.equal(model.ramps[0].clipped, false)
  for (let i = 0; i < segments.length - 1; i++)
    assert.ok(Math.abs(model.profiles[i].end - model.profiles[i + 1].start) < 1e-8)
  const before = JSON.stringify(p)
  const suggestion = suggestRampLengths(p, 15)
  assert.equal(suggestion.settings.descentLengthMm, 2000)
  assert.equal(suggestion.directions[0].limited, false)
  assert.ok(suggestion.directions[0].maxPercent <= 15.01)
  assert.ok(suggestion.directions[0].rails.length > 2)
  assert.equal(JSON.stringify(p), before)
})

test('suggestions report insufficient space and do not override custom height points', async () => {
  const { suggestRampLengths } = await import('../addons/track-planner/src/components/rampSuggestions.js')
  const p = plan()
  assert.ok(suggestRampLengths(p, 1).directions.some((r) => r.limited))
  p.pieces[5].elevation = { heightMm: 160, flat: true }
  assert.equal(suggestRampLengths(p, 15).custom, true)
})

test('ascent and descent percentages independently set smooth lengths and preserve crossings', async () => {
  const { suggestRampLengths } = await import('../addons/track-planner/src/components/rampSuggestions.js')
  const { buildTrackElevationModel } = await import('../addons/track-planner/src/components/trackElevationModel.js')
  const { readFile } = await import('node:fs/promises')
  const p = JSON.parse(
    await readFile(new URL('../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url)),
  )
  const s = suggestRampLengths(p, { ascent: 10, descent: 20 })
  assert.equal(s.settings.ascentLengthMm, 3000)
  assert.equal(s.settings.descentLengthMm, 1500)
  const m = buildTrackElevationModel({ ...p, sceneRamps: s.settings })
  for (const r of m.ramps) assert.ok(r.maxPercent <= (r.up ? 10 : 20) + 0.01)
  for (let i = 0; i < m.heights.length - 1; i++) assert.ok(Math.abs(m.heights[i].end - m.heights[i + 1].start) < 1e-8)
  for (const c of m.crossingMeasures) assert.ok(Math.abs(c.clearanceMm - 150) < 1e-6)
  for (const bad of [
    { ascent: 0, descent: 15 },
    { ascent: 15, descent: NaN },
    { ascent: 15 },
    { ascent: '10', descent: 15 },
  ])
    assert.throws(() => suggestRampLengths(p, bad))
})
