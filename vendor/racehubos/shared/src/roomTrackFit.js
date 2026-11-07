// Planner-owned placement of actual track surfaces in an orthogonal room.
import { roomFootprint } from './roomFootprint.js'
import { roomTrackArea } from './roomConfiguration.js'
import { traceTrackPlan } from './trackPlan.js'
import { roadPolygon, borderShapes, pitRoadPolygons } from './trackBorderGeometry.js'
import { unitHousingPolygon } from './trackUnitGeometry.js'
import { softyExtraGeometry } from './softyExtraGeometry.js'
const box = (poly) => ({
  x: Math.min(...poly.map((p) => p[0])),
  y: Math.min(...poly.map((p) => p[1])),
  right: Math.max(...poly.map((p) => p[0])),
  bottom: Math.max(...poly.map((p) => p[1])),
})
export function roomSearchArea(room) {
  if (!room.features?.length) return roomTrackArea(room)
  const b = roomFootprint(room).bounds,
    e = room.edgeM * 1000
  return {
    width: Math.min(b.width - 2 * e, (room.reference?.widthM ?? Infinity) * 1000),
    depth: Math.min(b.depth - 2 * e, (room.reference?.depthM ?? Infinity) * 1000),
  }
}
function simplifyPolygon(poly) {
  const points = poly.filter((p, i) => !i || Math.hypot(p[0] - poly[i - 1][0], p[1] - poly[i - 1][1]) > 1e-8)
  if (points.length > 1 && Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) < 1e-8)
    points.pop()
  return points.filter((p, i) => {
    const a = points[(i + points.length - 1) % points.length],
      b = points[(i + 1) % points.length]
    return (
      Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-7 ||
      (p[0] - a[0]) * (b[0] - p[0]) + (p[1] - a[1]) * (b[1] - p[1]) < 0
    )
  })
}
export function trackRoomPolygons(plan) {
  const segments = traceTrackPlan(plan).segments
  return [
    ...segments.map(roadPolygon),
    ...segments.map(unitHousingPolygon),
    ...borderShapes(plan, segments).map((b) => b.points),
    ...pitRoadPolygons(plan, segments),
    ...(plan.trackExtras || []).filter((e) => !e.hidden).map((e) => softyExtraGeometry(e, segments).polygon),
  ]
    .filter((p) => p?.length >= 3)
    .map(simplifyPolygon)
    .filter((p) => p.length >= 3)
}
export function roomFitContext(room) {
  const footprint = roomFootprint(room),
    b = footprint.bounds,
    e = room.edgeM * 1000
  // Drivers and aisle remain reserved in the base room, including its bottom edge.
  const reserve = {
    x: 0,
    y: (room.depthM - room.edgeM - room.driverDepthM - room.aisleM) * 1000,
    right: room.widthM * 1000,
    bottom: room.depthM * 1000,
  }
  const xs = [
    ...new Set([
      b.x,
      b.x + b.width,
      reserve.x,
      reserve.right,
      ...footprint.cells.flatMap((c) => [c.x * 1000, (c.x + c.w) * 1000]),
    ]),
  ]
    .filter((n) => n >= b.x && n <= b.x + b.width)
    .sort((a, b) => a - b)
  const ys = [
    ...new Set([
      b.y,
      b.y + b.depth,
      reserve.y,
      reserve.bottom,
      ...footprint.cells.flatMap((c) => [c.y * 1000, (c.y + c.h) * 1000]),
    ]),
  ]
    .filter((n) => n >= b.y && n <= b.y + b.depth)
    .sort((a, b) => a - b)
  const allowed = (x, y) =>
    !(x > reserve.x && x < reserve.right && y > reserve.y && y < reserve.bottom) &&
    footprint.cells.some((c) => x > c.x * 1000 && x < (c.x + c.w) * 1000 && y > c.y * 1000 && y < (c.y + c.h) * 1000)
  const forbidden = []
  let usableArea = 0
  for (let j = 0; j < ys.length - 1; j++) {
    let start = null
    for (let i = 0; i < xs.length; i++) {
      const blocked = i < xs.length - 1 && !allowed((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2)
      if (!blocked && i < xs.length - 1) usableArea += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j])
      if (blocked && start === null) start = xs[i]
      if (!blocked && start !== null) {
        const last = forbidden.find((r) => r.x === start && r.right === xs[i] && r.bottom === ys[j])
        if (last) last.bottom = ys[j + 1]
        else forbidden.push({ x: start, y: ys[j], right: xs[i], bottom: ys[j + 1] })
        start = null
      }
    }
  }
  // 1 mm conservatism covers the chord approximation of rendered curves.
  const margin = e + 1
  return {
    usableArea,
    bounds: { x: b.x + margin, y: b.y + margin, right: b.x + b.width - margin, bottom: b.y + b.depth - margin },
    forbidden: forbidden.map((r) => ({
      x: r.x - margin,
      y: r.y - margin,
      right: r.right + margin,
      bottom: r.bottom + margin,
    })),
    preferred: { x: room.widthM * 500, y: reserve.y / 2 },
    room,
  }
}
function clippedArea(poly, rect, dx, dy) {
  let points = poly.map((p) => [p[0] + dx, p[1] + dy])
  for (const [axis, edge, sign] of [
    [0, rect.x, 1],
    [0, rect.right, -1],
    [1, rect.y, 1],
    [1, rect.bottom, -1],
  ]) {
    const out = []
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        insideA = sign * (a[axis] - edge) >= 0,
        insideB = sign * (b[axis] - edge) >= 0
      if (insideA) out.push(a)
      if (insideA !== insideB) {
        const t = (edge - a[axis]) / (b[axis] - a[axis])
        out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
      }
    }
    points = out
    if (!points.length) return 0
  }
  return (
    Math.abs(
      points.reduce((sum, a, i) => {
        const b = points[(i + 1) % points.length]
        return sum + a[0] * b[1] - b[0] * a[1]
      }, 0),
    ) / 2
  )
}
export function roomPolygonsFit(polygons, context, dx, dy, boxes = polygons.map(box)) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false
  const wall = context.bounds
  for (let i = 0; i < polygons.length; i++) {
    const poly = polygons[i],
      b = boxes[i],
      x = b.x + dx,
      y = b.y + dy,
      right = b.right + dx,
      bottom = b.bottom + dy
    if (x < wall.x - 0.001 || y < wall.y - 0.001 || right > wall.right + 0.001 || bottom > wall.bottom + 0.001)
      return false
    for (const r of context.forbidden)
      if (right > r.x && x < r.right && bottom > r.y && y < r.bottom && clippedArea(poly, r, dx, dy) > 0.001)
        return false
  }
  return true
}
export function fitTrackInRoom(plan, room, context = roomFitContext(room)) {
  if (context.usableArea === 0) return null
  const polygons = trackRoomPolygons(plan)
  if (!polygons.length) return null
  const boxes = polygons.map(box),
    b = {
      x: Math.min(...boxes.map((b) => b.x)),
      y: Math.min(...boxes.map((b) => b.y)),
      right: Math.max(...boxes.map((b) => b.right)),
      bottom: Math.max(...boxes.map((b) => b.bottom)),
    },
    wall = context.bounds
  const minX = wall.x - b.x,
    maxX = wall.right - b.right,
    minY = wall.y - b.y,
    maxY = wall.bottom - b.bottom
  if (minX > maxX || minY > maxY) return null
  const center = {
    x: Math.max(minX, Math.min(maxX, context.preferred.x - (b.x + b.right) / 2)),
    y: Math.max(minY, Math.min(maxY, context.preferred.y - (b.y + b.bottom) / 2)),
  }
  const axes = (axis, min, max, preferred) => {
    const end = axis === 'x' ? 'right' : 'bottom',
      values = [preferred, min, max, (min + max) / 2]
    for (const r of context.forbidden)
      for (const shape of boxes) values.push(r[axis] - shape[end] - 0.01, r[end] - shape[axis] + 0.01)
    // Deterministic bounded search, prioritising small translations from the centre.
    return [...new Set(values.filter((v) => v >= min && v <= max).map((v) => Math.round(v * 1000) / 1000))]
      .sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))
      .slice(0, 32)
  }
  const xs = axes('x', minX, maxX, center.x),
    ys = axes('y', minY, maxY, center.y)
  const placements = xs
    .flatMap((x) => ys.map((y) => ({ x, y, d: Math.hypot(x - center.x, y - center.y) })))
    .sort((a, b) => a.d - b.d)
  for (const p of placements)
    if (roomPolygonsFit(polygons, context, p.x, p.y, boxes))
      return { room: { ...room, backgroundOrigin: { xMm: -p.x, yMm: -p.y } }, translation: { x: p.x, y: p.y } }
  return null
}
