import test from 'node:test'
import assert from 'node:assert/strict'
import {
  connectLegacyHost,
  LEGACY_CHANNEL,
  encodeLegacyRoom,
  decodeLegacyRoom,
} from '../addons/track-planner/src/host/legacyBridge.js'
import { createLayoutHandoff } from '../addons/track-planner/src/host/layoutHandoff.js'
import {
  emptyTrackPlan,
  readTrackPlan,
  enableFreePlacement,
  traceTrackPlan,
  transformFreeParts,
} from '../vendor/racehubos/shared/src/index.js'
function fake() {
  const sent = [],
    listeners = new Set(),
    received = [],
    status = []
  const surface = {
    parent: { postMessage: (data, origin) => sent.push({ data, origin }) },
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  }
  const bridge = connectLegacyHost({
    surface,
    origin: 'https://host.example',
    onInitialize: (m) => received.push(m),
    onStatus: (m) => status.push(m),
  })
  const emit = (data, overrides = {}) => {
    for (const fn of listeners)
      fn({
        source: surface.parent,
        origin: 'https://host.example',
        data: { channel: LEGACY_CHANNEL, ...data },
        ...overrides,
      })
  }
  return { sent, listeners, received, status, surface, bridge, emit }
}
test('legacy adapter announces readiness, accepts valid init and disposes listeners', () => {
  const f = fake()
  assert.equal(f.sent[0].data.type, 'ready')
  assert.equal(f.sent[0].origin, 'https://host.example')
  f.emit({ type: 'init', draft: { plan: emptyTrackPlan(), name: 'Demo' }, language: 'de', dark: true })
  assert.equal(f.received[0].draft.name, 'Demo')
  assert.equal(f.received[0].language, 'de')
  assert.equal(f.received[0].dark, true)
  f.bridge.dispose()
  assert.equal(f.listeners.size, 0)
})
test('legacy adapter ignores wrong sender, origin, channel and malformed drafts', () => {
  const f = fake(),
    message = { type: 'init', draft: { plan: emptyTrackPlan(), name: 'Demo' } }
  f.emit(message, { origin: 'https://other.example' })
  f.emit(message, { source: {} })
  f.emit({ ...message, channel: 'other' })
  f.emit({ type: 'init', draft: { plan: null, name: 'Demo' } })
  f.emit({ type: 'init', draft: { plan: emptyTrackPlan(), name: 42 } })
  assert.equal(f.received.length, 0)
})
test('legacy adapter only sends documented compatibility actions and sanitizes status', () => {
  const f = fake()
  f.bridge.send('save', { name: 'Demo', plan: emptyTrackPlan() })
  assert.equal(f.sent.at(-1).data.type, 'save')
  assert.throws(() => f.bridge.send('execute', {}))
  f.emit({ type: 'status', status: { saving: true, error: 42, success: 'Saved' } })
  assert.deepEqual(f.status[0], { saving: true, error: '', success: 'Saved' })
})
const plan = () =>
  transformFreeParts(
    enableFreePlacement({
      ...emptyTrackPlan(),
      pieces: [
        { type: 'Standardgerade', level: 0, jointDegrees: 0 },
        { type: 'Kurve_1_60_rechts', level: 0, jointDegrees: 0 },
      ],
    }),
    [0, 1],
    { degrees: 90, dx: 1200, dy: 700 },
  )
test('handoff preserves the native plan and exposes exact geometry and sector endpoints', () => {
  const p = plan(),
    snapshot = JSON.stringify(p),
    trace = traceTrackPlan(p)
  const handoff = createLayoutHandoff(p, {
    name: 'RaceHubOS demo',
    sectors: [{ id: 's1', label: 'Sektor 1', railIndex: 1, end: 1 }],
  })
  assert.equal(handoff.schema, 'carrera-track-layout/v1')
  assert.equal(handoff.geometry.units, 'mm')
  assert.equal(handoff.geometry.rails.length, 2)
  assert.deepEqual(handoff.geometry.laneLengthsM, trace.laneLengthsM)
  assert.equal(handoff.sectors[0].position.xMm, trace.segments[1].end.x)
  assert.equal(handoff.sectors[0].position.yMm, trace.segments[1].end.y)
  assert.equal(JSON.stringify(p), snapshot)
  assert.deepEqual(JSON.parse(JSON.stringify(handoff)).plan, handoff.plan)
})
test('handoff rejects invalid and duplicate sector anchors', () => {
  const p = plan(),
    s = { id: 's1', label: 'S1', railIndex: 0, end: 0 }
  assert.throws(() => createLayoutHandoff(p, { sectors: [s, s] }))
  assert.throws(() => createLayoutHandoff(p, { sectors: [{ ...s, railIndex: 99 }] }))
  assert.throws(() => createLayoutHandoff(p, { sectors: [{ ...s, end: 0.5 }] }))
  assert.throws(() => createLayoutHandoff(null))
})

test('legacy compatibility preserves heights, ramps and manual labels through a lossy host', () => {
  const original = {
    ...emptyTrackPlan(),
    showElevationLabels: false,
    sceneHeights: { clearance: 175 },
    sceneRamps: { ascentLengthMm: 1200, descentLengthMm: 1400 },
    pieces: [
      {
        type: 'Standardgerade',
        level: 0,
        jointDegrees: 0,
        elevation: { heightMm: 180, flat: true },
        heightLabelOffset: { alongMm: 45, acrossMm: -200 },
      },
    ],
  }
  const valid = readTrackPlan(original)
  assert.ok(valid)
  const encoded = encodeLegacyRoom(valid)
  const oldHost = {
    ...encoded,
    pieces: encoded.pieces.map(({ type, level, jointDegrees }) => ({ type, level, jointDegrees })),
  }
  for (const key of ['sceneHeights', 'sceneRamps', 'showElevationLabels']) delete oldHost[key]
  assert.deepEqual(decodeLegacyRoom(JSON.stringify(oldHost)), valid)
  assert.equal(original.pit.plannerSceneV1, undefined)
})
test('legacy scene snapshots reject invalid heights and mismatched rail sequences', () => {
  const plan = {
    ...emptyTrackPlan(),
    pieces: [{ type: 'Standardgerade', level: 0, jointDegrees: 0, elevation: { heightMm: 100, flat: true } }],
  }
  const encoded = encodeLegacyRoom(plan)
  const malformed = structuredClone(encoded)
  malformed.pit.plannerSceneV1.pieces[0].elevation.heightMm = -1
  assert.equal(decodeLegacyRoom(malformed), null)
  const changed = structuredClone(encoded)
  changed.pieces.push({ ...changed.pieces[0] })
  assert.equal(decodeLegacyRoom(changed), null)
})
