import { buildTrackElevationModel, railHeightAt, rampHeight } from './trackElevationModel.js'
export { sceneTrackHeights, rampHeight } from './trackElevationModel.js'
import { DEFAULT_SCENE_HEIGHTS } from '../../../../vendor/racehubos/shared/src/trackPlan.js'
import {
  traceTrackPlan,
  borderShapes,
  softyExtraGeometry,
  extraWorldPose,
  editablePitlane,
  nativeFuelBayIndices,
} from '@racehubos/shared'
import { roadPolygon } from '../../../../vendor/racehubos/shared/src/trackBorderGeometry.js'
import { unitHousingPolygon } from '../../../../vendor/racehubos/shared/src/trackUnitGeometry.js'
import { roomFootprint, anchorRoom } from './roomBackground.js'
const rect = (x, y, w, h) => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
]
const simplify = (raw) => {
  const p = raw.filter((v, i) => !i || Math.hypot(v[0] - raw[i - 1][0], v[1] - raw[i - 1][1]) > 1e-8)
  if (p.length > 1 && Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 1e-8) p.pop()
  const clean = p.filter((v, i) => {
    const a = p[(i + p.length - 1) % p.length],
      b = p[(i + 1) % p.length]
    return Math.abs((v[0] - a[0]) * (b[1] - v[1]) - (v[1] - a[1]) * (b[0] - v[0])) > 1e-5
  })
  const critical = new Set([0, clean.length - 1])
  for (const axis of [0, 1])
    for (const sign of [-1, 1]) {
      let index = 0
      for (let i = 1; i < clean.length; i++) if (sign * clean[i][axis] > sign * clean[index][axis]) index = i
      critical.add(index)
    }
  return clean.filter((v, i) => {
    if (clean.length < 24 || i % 2 === 0 || critical.has(i)) return true
    const a = clean[(i + clean.length - 1) % clean.length],
      b = clean[(i + 1) % clean.length],
      cross = Math.abs((v[0] - a[0]) * (b[1] - v[1]) - (v[1] - a[1]) * (b[0] - v[0]))
    return cross / Math.max(1e-9, Math.hypot(v[0] - a[0], v[1] - a[1]) * Math.hypot(b[0] - v[0], b[1] - v[1])) > 0.1
  })
}
export function project3D([x, y, z], camera, center = [0, 0]) {
  const yaw = (camera.yaw * Math.PI) / 180,
    pitch = (camera.pitch * Math.PI) / 180,
    dx = x - center[0],
    dy = y - center[1],
    horizontal = dx * Math.cos(yaw) - dy * Math.sin(yaw),
    depth = dx * Math.sin(yaw) + dy * Math.cos(yaw)
  return {
    x: horizontal,
    y: depth * Math.sin(pitch) - z * Math.cos(pitch),
    depth: depth * Math.cos(pitch) + z * Math.sin(pitch),
  }
}
export function planeMatrix(x, y, heading, z, camera, center, slope = 0) {
  const a = (heading * Math.PI) / 180,
    p = project3D([x, y, z], camera, center),
    u = project3D([x + Math.cos(a), y + Math.sin(a), z + slope], camera, center),
    v = project3D([x - Math.sin(a), y + Math.cos(a), z], camera, center)
  return `matrix(${u.x - p.x} ${u.y - p.y} ${v.x - p.x} ${v.y - p.y} ${p.x} ${p.y})`
}
export function buildRoomScene(input, overrides = {}) {
  const { wallHeight, obstacleHeight, baseHeight, clearance } = {
    ...DEFAULT_SCENE_HEIGHTS,
    ...input.sceneHeights,
    ...overrides,
  }
  // Work on a validated native pit copy; never change the editable plan.
  const plan = input.pit.enabled && !input.pit.native ? editablePitlane(input).plan : input,
    segments = traceTrackPlan(plan).segments,
    room = plan.roomPlan ? anchorRoom(plan.roomPlan, plan) : null,
    faces = [],
    lines = [],
    art = [],
    labels = []
  let serial = 0
  const face = (points, color, kind, meta = {}) => faces.push({ id: `f${serial++}`, points, color, kind, ...meta })
  function solid(poly, bottom, top, color, kind, meta = {}) {
    if (poly.length < 3) return
    const area = poly.reduce((sum, p, i) => {
      const q = poly[(i + 1) % poly.length]
      return sum + p[0] * q[1] - q[0] * p[1]
    }, 0)
    const vertices = area < 0 ? [...poly].reverse() : poly
    const height = (p, f) => (typeof f === 'function' ? f(p) : f)
    face(
      vertices.map((p) => [...p, height(p, top)]),
      color,
      kind,
      { ...meta, top: true },
    )
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i],
        b = vertices[(i + 1) % vertices.length]
      face(
        [
          [...a, height(a, bottom)],
          [...b, height(b, bottom)],
          [...b, height(b, top)],
          [...a, height(a, top)],
        ],
        color,
        kind,
        { ...meta, side: true },
      )
    }
  }
  if (room) {
    const origin = room.backgroundOrigin,
      shape = roomFootprint(room),
      outer = roomFootprint({ ...room, features: (room.features || []).filter((f) => f.kind === 'extension') }),
      cells = new Set(outer.cells.map((c) => `${c.i},${c.j}`))
    const world = (p) => [p[0] + origin.xMm, p[1] + origin.yMm]
    for (const c of shape.cells)
      face(
        rect(c.x * 1000, c.y * 1000, c.w * 1000, c.h * 1000).map((p) => [...world(p), 0]),
        '#e7e3da',
        'floor',
      )
    for (const c of outer.cells) {
      const x = c.x * 1000,
        y = c.y * 1000,
        w = c.w * 1000,
        h = c.h * 1000
      const edges = [
        [
          -1,
          0,
          [
            [x, y + h],
            [x, y],
          ],
        ],
        [
          1,
          0,
          [
            [x + w, y],
            [x + w, y + h],
          ],
        ],
        [
          0,
          -1,
          [
            [x, y],
            [x + w, y],
          ],
        ],
        [
          0,
          1,
          [
            [x + w, y + h],
            [x, y + h],
          ],
        ],
      ]
      for (const [di, dj, [a, b]] of edges)
        if (!cells.has(`${c.i + di},${c.j + dj}`)) {
          const aw = world(a),
            bw = world(b)
          face(
            [
              [...aw, 0],
              [...bw, 0],
              [...bw, wallHeight],
              [...aw, wallHeight],
            ],
            '#dce4ec',
            'wall',
            { normal: [b[1] - a[1], a[0] - b[0]] },
          )
        }
    }
    for (const f of room.features || []) {
      if (f.kind === 'extension') {
        labels.push({
          point: [...world([(f.xM + f.widthM / 2) * 1000, (f.yM + f.depthM / 2) * 1000]), 5],
          text: f.name,
          kind: 'room',
        })
        continue
      }
      for (const c of outer.cells) {
        const x = Math.max(f.xM, c.x),
          y = Math.max(f.yM, c.y),
          right = Math.min(f.xM + f.widthM, c.x + c.w),
          bottom = Math.min(f.yM + f.depthM, c.y + c.h)
        if (right > x && bottom > y)
          solid(
            rect(x * 1000, y * 1000, (right - x) * 1000, (bottom - y) * 1000).map(world),
            0,
            obstacleHeight,
            '#bc7668',
            'obstacle',
            { feature: f.id },
          )
      }
      labels.push({
        point: [...world([(f.xM + f.widthM / 2) * 1000, (f.yM + f.depthM / 2) * 1000]), obstacleHeight + 40],
        text: f.name,
        kind: 'obstacle',
      })
    }
    const edge = room.edgeM * 1000,
      driverY = (room.depthM - room.edgeM - room.driverDepthM) * 1000
    face(
      rect(edge, driverY - room.aisleM * 1000, room.widthM * 1000 - 2 * edge, room.aisleM * 1000).map((p) => [
        ...world(p),
        1,
      ]),
      '#bee3e5',
      'aisle',
    )
    for (let i = 0; i < room.drivers; i++)
      face(
        rect(edge + i * room.driverWidthM * 1000, driverY, room.driverWidthM * 1000, room.driverDepthM * 1000).map(
          (p) => [...world(p), 2],
        ),
        '#b6ceb6',
        'driver',
      )
  }
  const elevationModel = buildTrackElevationModel(plan, { clearance, baseHeight }, segments)
  const { heights, crossingMeasures } = elevationModel
  const heightAt = (s, p) => railHeightAt(s, heights[s.index], p)
  for (const s of segments) {
    const raw = roadPolygon(s),
      poly = simplify(raw),
      outline = poly.length >= 3 ? poly : raw,
      z = (p) => heightAt(s, p)
    // Tessellate the road across its width so a straight ramp is curved in elevation too.
    const h = heights[s.index]
    if ((h.sloped || h.start !== h.end) && raw.length === 66) {
      for (let j = 0; j < 32; j++) {
        const a = raw[j],
          b = raw[j + 1],
          c = raw[64 - j],
          d = raw[65 - j]
        const za = rampHeight(h, j / 32),
          zb = rampHeight(h, (j + 1) / 32)
        face(
          [
            [...a, za + 12],
            [...b, zb + 12],
            [...c, zb + 12],
            [...d, za + 12],
          ],
          '#30363b',
          'track',
          { rail: s.index, top: true, mesh: true },
        )
        for (const [p, q] of [
          [a, b],
          [d, c],
        ])
          face(
            [
              [...p, za + 2],
              [...q, zb + 2],
              [...q, zb + 12],
              [...p, za + 12],
            ],
            '#30363b',
            'track',
            { rail: s.index, side: true, mesh: true },
          )
      }
    } else {
      solid(
        outline,
        (p) => z(p) + 2,
        (p) => z(p) + 12,
        '#30363b',
        'track',
        { rail: s.index },
      )
    }
    for (const lane of [1, 2])
      lines.push({
        id: `slot-${s.index}-${lane}`,
        points: s.points[lane].map((p, i) => [...p, rampHeight(heights[s.index], i / 32) + 13]),
        color: '#c4cbd0',
        width: 5,
        kind: 'slot',
        rail: s.index,
      })
    lines.push({
      id: `centre-${s.index}`,
      points: s.points[0].map((p, i) => [...p, rampHeight(heights[s.index], i / 32) + 13]),
      color: '#bdc4c7',
      width: 3,
      dash: '38 40',
      kind: 'centre',
      rail: s.index,
    })
    const hull = unitHousingPolygon(s)
    if (hull.length)
      solid(
        hull,
        (p) => z(p) + 12,
        (p) => z(p) + 55,
        '#262b31',
        'unit',
        { rail: s.index },
      )
    if (
      ['Control_unit', 'AdapterUnit', 'Check_lane', 'Multistart', 'Pit_stop_weiche_anfang'].includes(s.type) ||
      /^(DigitaleDoppelweiche|Weiche_(links|rechts)|Kurvenweiche_(links|rechts)_(ai|ia))_1$/.test(s.type)
    ) {
      art.push({
        id: `unit-road-${s.index}`,
        kind: 'unit-road',
        x: s.start.x,
        y: s.start.y,
        heading: (s.start.h * 180) / Math.PI,
        z: heights[s.index].start + 13,
        slope: (heights[s.index].end - heights[s.index].start) / 345,
        type: s.type,
        index: s.index,
      })
      if (hull.length)
        art.push({
          id: `unit-top-${s.index}`,
          kind: 'unit-top',
          x: s.start.x,
          y: s.start.y,
          heading: (s.start.h * 180) / Math.PI,
          z: heights[s.index].start + 56,
          type: s.type,
          index: s.index,
        })
    }
  }
  for (const b of borderShapes(plan, segments)) {
    const s = segments[b.index]
    solid(
      b.points,
      (p) => heightAt(s, p) + 2,
      (p) => heightAt(s, p) + 12,
      b.kind === 'strip' ? '#f1ece4' : '#e6dfd3',
      'border',
      { rail: b.index },
    )
    if (b.kind === 'strip') {
      const n = b.points.length
      for (let i = 0; i < 32; i += 8) {
        const poly = [
          b.points[i],
          b.points[Math.min(32, i + 4)],
          b.points[n - 1 - Math.min(32, i + 4)],
          b.points[n - 1 - i],
        ]
        face(
          poly.map((p) => [...p, heightAt(s, p) + 13]),
          '#d94a45',
          'border-mark',
        )
      }
    }
  }
  const fuel = new Set(nativeFuelBayIndices(plan, segments))
  for (const [i, e] of (plan.trackExtras || []).entries()) {
    if (e.hidden) continue
    const g = softyExtraGeometry(e, segments),
      z =
        heightAt(segments[e.anchor], g.polygon[0] ?? segments[e.anchor].points[0][0]) +
        ((e.level ?? segments[e.anchor].level ?? 0) - (segments[e.anchor].level ?? 0)) * (clearance + 10),
      poly = simplify(g.polygon)
    solid(
      poly.length >= 3 ? poly : g.polygon,
      z + 2,
      z + 12,
      g.border ? '#ded7c8' : '#30363b',
      g.border ? 'border' : 'pit',
      { extra: i },
    )
    for (const [j, points] of g.slots.entries())
      lines.push({
        id: `pit-slot-${i}-${j}`,
        points: points.map((p) => [...p, z + 13]),
        color: '#c4cbd0',
        width: 5,
        kind: 'slot',
        extra: i,
      })
    if (e.kind === 'pitEntry') {
      const pose = extraWorldPose(e, segments)
      art.push({
        id: `pit-switch-${i}`,
        kind: 'pit-switch',
        x: pose.xMm,
        y: pose.yMm,
        heading: pose.headingDegrees,
        z: z + 13,
        index: i,
      })
    }
    if (fuel.has(i)) {
      const pose = extraWorldPose(e, segments)
      art.push({
        id: `fuel-${i}`,
        kind: 'fuel',
        x: pose.xMm,
        y: pose.yMm,
        heading: pose.headingDegrees,
        z: z + 13,
        index: i,
      })
    }
  }
  for (const measure of crossingMeasures) {
    const { point: hit, low, high, number } = measure
    lines.push({
      id: `clearance-${number}`,
      kind: 'clearance',
      points: [
        [...hit, low],
        [...hit, high],
      ],
      color: high < low ? '#dc2626' : '#7c3aed',
      width: 7,
      dash: '16 12',
    })
    labels.push({
      point: [hit[0] + 70, hit[1], (low + high) / 2],
      text: `${Math.round(high - low)} mm`,
      kind: 'clearance',
    })
  }
  const all = [...faces.flatMap((f) => f.points), ...lines.flatMap((l) => l.points)]
  if (!all.length) all.push([-1000, -1000, 0], [1000, 1000, 0])
  const xs = all.map((p) => p[0]),
    ys = all.map((p) => p[1]),
    center = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  return {
    faces,
    lines,
    art,
    labels,
    center,
    hasRoom: !!room,
    railCount: segments.length,
    ramps: elevationModel.ramps,
    crossingMeasures,
    baseHeight,
    levelHeight: clearance + 10,
    clearance,
  }
}
export function projectRoomScene(
  scene,
  camera,
  { walls = true, cutaway = true, obstacles = true, labels = true, dimensions = true } = {},
) {
  const items = [],
    roadDepth = new Map(),
    extraDepth = new Map(),
    unitDepth = new Map()
  for (const f of scene.faces) {
    if (
      f.kind === 'wall' &&
      (!walls ||
        (cutaway &&
          f.normal[0] * Math.sin((camera.yaw * Math.PI) / 180) + f.normal[1] * Math.cos((camera.yaw * Math.PI) / 180) >
            0))
    )
      continue
    if (f.kind === 'obstacle' && !obstacles) continue
    const points = f.points.map((p) => project3D(p, camera, scene.center)),
      depth = points.reduce((sum, p) => sum + p.depth, 0) / points.length
    const ground = ['floor', 'aisle', 'driver'].includes(f.kind)
    if (f.top && f.kind === 'track') roadDepth.set(f.rail, depth)
    if (f.top && f.kind === 'pit') extraDepth.set(f.extra, depth)
    if (f.top && f.kind === 'unit') unitDepth.set(f.rail, depth)
    items.push({ ...f, points, depth: ground ? -1e8 + depth : depth, render: 'face' })
  }
  const drawingLines = scene.lines.flatMap((l) => {
    if (l.rail === undefined || l.points.every((p) => Math.abs(p[2] - l.points[0][2]) < 1e-8)) return [l]
    return l.points.slice(1).map((p, i) => ({ ...l, id: `${l.id}-${i}`, points: [l.points[i], p], ramp: true }))
  })
  for (const l of drawingLines) {
    if (l.kind === 'clearance' && (!dimensions || camera.pitch > 85)) continue
    const points = l.points.map((p) => project3D(p, camera, scene.center))
    items.push({
      ...l,
      points,
      depth:
        l.kind === 'clearance'
          ? 1e9 - 1
          : l.ramp
            ? points.reduce((sum, p) => sum + p.depth, 0) / points.length + 0.1
            : (l.rail !== undefined ? roadDepth.get(l.rail) : extraDepth.get(l.extra)) + 0.1,
      render: 'line',
    })
  }
  for (const a of scene.art) {
    const p = project3D([a.x, a.y, a.z], camera, scene.center)
    const depth =
      a.kind === 'unit-top'
        ? unitDepth.get(a.index)
        : a.kind === 'unit-road'
          ? roadDepth.get(a.index)
          : extraDepth.get(a.index)
    items.push({
      ...a,
      matrix: planeMatrix(a.x, a.y, a.heading, a.z, camera, scene.center, a.slope),
      depth: (depth ?? p.depth) + 0.2,
      render: 'art',
    })
  }
  for (const label of scene.labels) {
    if (label.kind === 'clearance' ? !dimensions || camera.pitch > 85 : !labels) continue
    if (label.kind === 'obstacle' && !obstacles) continue
    const p = project3D(label.point, camera, scene.center)
    items.push({ ...label, point: p, depth: 1e9, render: 'label' })
  }
  items.sort((a, b) => a.depth - b.depth)
  const points = items.flatMap((i) => (i.points || i.point ? [...(i.points || [i.point])] : []))
  if (!points.length) points.push({ x: -1000, y: -1000 }, { x: 1000, y: 1000 })
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y),
    x = Math.min(...xs),
    y = Math.min(...ys)
  return { items, bounds: { x, y, width: Math.max(...xs) - x, depth: Math.max(...ys) - y } }
}
