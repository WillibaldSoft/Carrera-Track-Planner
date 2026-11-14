import { traceTrackPlan, DEFAULT_SCENE_HEIGHTS } from '../../../../vendor/racehubos/shared/src/trackPlan.js'
import { checkDetailedGeometry } from '../../../../vendor/racehubos/shared/src/detailedTrackSearch.js'
import { buildRampProfiles } from './rampProfiles.js'
const pointKey = (p) => `${Math.round(p.x)},${Math.round(p.y)}`
export function sceneTrackHeights(segments, levelHeight = 160, baseHeight = 0, pinned = new Set()) {
  const ports = new Map()
  for (const s of segments)
    for (const end of ['start', 'end']) {
      const p = s[end],
        key = pointKey(p)
      if (!ports.has(key)) ports.set(key, [])
      ports.get(key).push({ index: s.index, h: p.h, level: s.level ?? 0, type: s.type, fixed: pinned.has(s.index) })
    }
  return segments.map((s) => {
    const level = s.level ?? 0,
      unit = ['Control_unit', 'AdapterUnit'].includes(s.type) || pinned.has(s.index)
    const at = (end) => {
      if (unit) return baseHeight + level * levelHeight
      const p = s[end],
        near = (ports.get(pointKey(p)) || []).filter(
          (q) => q.index !== s.index && Math.abs(Math.sin(q.h - p.h)) < 0.001,
        )
      if (near.length !== 1) return baseHeight + level * levelHeight
      const q = near[0],
        target = q.fixed || ['Control_unit', 'AdapterUnit'].includes(q.type) ? q.level : (q.level + level) / 2
      return baseHeight + target * levelHeight
    }
    return { start: at('start'), end: at('end') }
  })
}
// Quintic easing joins level surfaces with zero slope and curvature at both ends.
export function rampHeight(height, t) {
  if (height.sample) return height.sample(t)
  const u = Math.max(0, Math.min(1, t))
  const eased = u * u * u * (10 + u * (-15 + 6 * u))
  return height.start + (height.end - height.start) * eased
}

export const railLength = (s) =>
  s.points[0].slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - s.points[0][i][0], p[1] - s.points[0][i][1]), 0)
export function buildTrackElevationModel(plan, overrides = {}, segments = traceTrackPlan(plan).segments) {
  const { clearance, baseHeight } = { ...DEFAULT_SCENE_HEIGHTS, ...plan.sceneHeights, ...overrides }
  const anchors = new Map(plan.pieces.flatMap((p, i) => (p.elevation ? [[i, p.elevation]] : [])))
  const crossings = checkDetailedGeometry(plan).crossings.filter((c) => anchors.size || c.levels[0] !== c.levels[1])
  const pinned = new Set(crossings.flatMap((c) => c.rails))
  const rampModel = buildRampProfiles(segments, plan.sceneRamps, clearance + 10, baseHeight, pinned, anchors)
  const heights = rampModel?.profiles ?? sceneTrackHeights(segments, clearance + 10, baseHeight, pinned)
  const metrics = segments.map((s) => {
    const h = heights[s.index],
      lengthMm = railLength(s)
    let peak = 0
    for (let i = 0; i < 128; i++) {
      const slope = ((rampHeight(h, (i + 1) / 128) - rampHeight(h, i / 128)) / (lengthMm / 128 || 1)) * 100
      if (Math.abs(slope) > Math.abs(peak)) peak = slope
    }
    return {
      index: s.index,
      startMm: h.start - baseHeight,
      endMm: h.end - baseHeight,
      lengthMm,
      meanPercent: ((h.end - h.start) / (lengthMm || 1)) * 100,
      peakPercent: peak,
    }
  })
  const crossingMeasures = []
  for (const [number, c] of crossings.entries()) {
    const a = segments[c.rails[0]],
      b = segments[c.rails[1]]
    let hit = null
    for (let i = 0; i < 32 && !hit; i++)
      for (let j = 0; j < 32 && !hit; j++) {
        const p = a.points[0][i],
          q = a.points[0][i + 1],
          r = b.points[0][j],
          s = b.points[0][j + 1]
        const ux = q[0] - p[0],
          uy = q[1] - p[1],
          vx = s[0] - r[0],
          vy = s[1] - r[1],
          d = ux * vy - uy * vx
        if (Math.abs(d) < 1e-9) continue
        const t = ((r[0] - p[0]) * vy - (r[1] - p[1]) * vx) / d,
          u = ((r[0] - p[0]) * uy - (r[1] - p[1]) * ux) / d
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) hit = [p[0] + t * ux, p[1] + t * uy]
      }
    if (!hit) continue
    const za = railHeightAt(a, heights[a.index], hit),
      zb = railHeightAt(b, heights[b.index], hit)
    const low = Math.min(za, zb) + 12,
      high = Math.max(za, zb) + 2
    crossingMeasures.push({
      number,
      point: hit,
      upperRail: za >= zb ? a.index : b.index,
      lowerRail: za >= zb ? b.index : a.index,
      lowerBaseHeight: Math.min(za, zb),
      clearanceMm: high - low,
      low,
      high,
    })
  }
  for (const m of metrics) {
    const values = crossingMeasures.filter((c) => c.upperRail === m.index).map((c) => c.clearanceMm)
    if (values.length) m.clearanceMm = Math.min(...values)
  }
  return {
    segments,
    crossings,
    heights,
    metrics,
    crossingMeasures,
    ramps: rampModel?.ramps ?? [],
    baseHeight,
    clearance,
  }
}
export function railHeightAt(s, h, p) {
  const points = s.points[0]
  let best = Infinity,
    index = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1],
      dx = b[0] - a[0],
      dy = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
    const d = (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2
    if (d < best) {
      best = d
      index = i + t
    }
  }
  return rampHeight(h, index / (points.length - 1))
}
export function setRailElevation(plan, index, value) {
  return {
    ...plan,
    pieces: plan.pieces.map((p, i) => {
      if (i !== index) return p
      const next = { ...p }
      if (value) next.elevation = ['Control_unit', 'AdapterUnit'].includes(p.type) ? { ...value, flat: true } : value
      else delete next.elevation
      return next
    }),
  }
}
export function gradientSpan(model, start, end) {
  if (start === end || !model.segments[start] || !model.segments[end]) throw new Error('span')
  const seen = new Set()
  let i = start,
    distanceMm = 0
  while (!seen.has(i)) {
    if (i === end)
      return {
        distanceMm,
        startMm: model.metrics[start].startMm,
        endMm: model.metrics[end].startMm,
        meanPercent: ((model.metrics[end].startMm - model.metrics[start].startMm) / distanceMm) * 100,
      }
    seen.add(i)
    const s = model.segments[i]
    distanceMm += railLength(s)
    const next = model.segments.filter(
      (q) =>
        q.index !== i &&
        Math.hypot(q.start.x - s.end.x, q.start.y - s.end.y) < 0.1 &&
        Math.abs(Math.sin(q.start.h - s.end.h)) < 0.1 &&
        Math.cos(q.start.h - s.end.h) > 0,
    )
    if (next.length !== 1) break
    i = next[0].index
  }
  throw new Error('span')
}
export function applyRailGradient(plan, model, start, end, percent) {
  if (!Number.isFinite(percent)) throw new Error('slope')
  const span = gradientSpan(model, start, end),
    heightMm = span.startMm + (span.distanceMm * percent) / 100
  if (heightMm < 0 || heightMm > 3000) throw new Error('height')
  if (['Control_unit', 'AdapterUnit'].includes(plan.pieces[start].type) && Math.abs(percent) > 1e-8)
    throw new Error('unit')
  return setRailElevation(setRailElevation(plan, start, { heightMm: span.startMm, flat: false }), end, {
    heightMm,
    flat: true,
  })
}
