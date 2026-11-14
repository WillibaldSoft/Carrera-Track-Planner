import {
  emptyTrackPlan,
  enableFreePlacement,
  validateTrackPlan,
  traceTrackPlan,
  editablePitlane,
  appendTrackTemplate,
  openTrackPorts,
  transformFreeParts,
  railRequirements,
  softyExtraGeometry,
} from '@racehubos/shared'
export function distributePitPlaces(total, stops) {
  if (!Number.isInteger(total) || total < 1 || total > 10 || !Number.isInteger(stops) || stops < 1 || stops > total)
    throw new Error('configuration')
  return Array.from({ length: stops }, (_, i) => Math.floor(total / stops) + (i < total % stops ? 1 : 0))
}
function station(bays, parallel, laneChange) {
  if (![1, 2].includes(bays) || (bays === 2 && !parallel)) throw new Error('configuration')
  const lanes = laneChange ? 2 : bays
  const length = laneChange ? 7 : 6
  let plan = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: Array.from({ length }, (_, i) => ({
      type: i === 0 ? 'Pit_stop_weiche_anfang' : i === length - 1 ? 'Pit_stop_weiche_ende' : 'Standardgerade',
      level: 0,
      jointDegrees: 0,
    })),
    pit: { enabled: true, entry: 0, merge: length - 1, spacingMm: 345, bayLengthMm: (length - 3) * 345 },
  })
  if (lanes === 2) {
    plan = editablePitlane(plan).plan
    let first = 1,
      second = bays === 2 ? 1 : 0
    plan.trackExtras = plan.trackExtras.map((e) => {
      if (e.kind !== 'single') return e
      const lane = e.placement.yMm > 200 ? 1 : 0
      // The common approach at x=517.5 is not a stopping place.
      const fuelBay = e.placement.xMm > (laneChange ? 1380 : 690) && (lane === 0 ? first-- > 0 : second-- > 0)
      return { ...e, fuelBay }
    })
    if (laneChange) {
      plan.trackExtras = plan.trackExtras.filter(
        (e) => e.kind !== 'single' || Math.abs(e.placement.xMm - 1207.5) > 0.01,
      )
      plan.trackExtras.push({
        kind: 'fixedCross',
        anchor: 0,
        level: 0,
        paintOrder: 12000,
        placement: { xMm: 1207.5, yMm: 198, headingDegrees: 0 },
      })
    }
  } else {
    const extras = [{ kind: 'pitEntry', anchor: 0, level: 0, placement: { xMm: 172.5, yMm: 99, headingDegrees: 180 } }]
    for (let i = 1; i < length - 1; i++)
      extras.push({
        kind: 'single',
        anchor: 0,
        level: 0,
        fuelBay: i <= bays,
        placement: { xMm: i * 345 + 172.5, yMm: 148.5, headingDegrees: 0 },
      })
    extras.push({
      kind: 'pitExit',
      anchor: length - 1,
      level: 0,
      placement: { xMm: 172.5, yMm: 99, headingDegrees: 180 },
    })
    plan = {
      ...plan,
      pit: { ...plan.pit, native: true },
      trackExtras: extras.map((e, i) => ({ ...e, paintOrder: i + 1 })),
    }
  }
  return validateTrackPlan({ ...plan, partGroups: { groups: [Array.from({ length }, (_, i) => i)], released: [] } })
}
export function createPitLayout({
  places = 2,
  stops = 1,
  distribution,
  parallel = false,
  laneChange = true,
  gap = 1,
} = {}) {
  const counts = distribution || distributePitPlaces(places, stops)
  if (
    !Array.isArray(counts) ||
    !counts.length ||
    counts.some((n) => !Number.isInteger(n) || n < 1) ||
    counts.reduce((a, b) => a + b, 0) !== places ||
    places < 1 ||
    places > 10 ||
    !Number.isInteger(gap) ||
    gap < 0 ||
    gap > 6
  )
    throw new Error('configuration')
  let plan = emptyTrackPlan()
  function attach(template) {
    plan = appendTrackTemplate(
      plan,
      template,
      plan.pieces.length ? openTrackPorts(plan).find((p) => p.index === plan.pieces.length - 1 && p.end === 1) : null,
    )
  }
  function straights(types) {
    return { ...emptyTrackPlan(), pieces: types.map((type) => ({ type, level: 0, jointDegrees: 0 })) }
  }
  counts.forEach((n, i) => {
    if (i && gap) attach(straights(Array(gap).fill('Standardgerade')))
    // A stopping car must never block another refuelling place. Each branch
    // has one fuel rail per lane, with its own entry and merge on the mainline.
    for (let remaining = n; remaining > 0;) {
      const bays = parallel && remaining >= 2 ? 2 : 1
      attach(station(bays, bays === 2, laneChange))
      remaining -= bays
    }
  })
  // Paint complete pit switches after their two-lane carriers: otherwise the
  // main road can cover the branching slot after templates are concatenated.
  plan = { ...plan, trackExtras: plan.trackExtras.map((e) => ({ ...e, paintOrder: 12000 })) }
  const requirements = railRequirements(plan)
  if (requirements.counts['30361'] !== places || !independentPitAccess(plan)) throw new Error('configuration')
  return plan
}
export function insertPitLayout(input, template, { placement = 'append', port, selected = 0, otherSide = false } = {}) {
  if (placement === 'append') {
    if (input.pieces.length && !port) throw new Error('openPort')
    return appendTrackTemplate(input, template, port, otherSide)
  }
  const plan = enableFreePlacement(input),
    segments = traceTrackPlan(plan).segments,
    count = template.pieces.length,
    start = segments[selected]?.start
  if (!start || selected + count > plan.pieces.length) throw new Error('straightSpace')
  const indices = Array.from({ length: count }, (_, i) => selected + i)
  if (plan.pit.enabled && indices.some((i) => i >= plan.pit.entry && i <= plan.pit.merge))
    throw new Error('protectedSpace')
  if (
    indices.some(
      (i) =>
        !['Standardgerade', 'Control_unit'].includes(plan.pieces[i].type) ||
        plan.pieces[i].borders ||
        (plan.trackExtras || []).some((e) => e.anchor === i) ||
        (plan.partGroups?.groups || []).some((g) => g.includes(i)),
    )
  )
    throw new Error('protectedSpace')
  for (let n = 0; n < count; n++) {
    const s = segments[selected + n]
    if (
      s.level !== segments[selected].level ||
      Math.hypot(s.start.x - start.x - n * 345 * Math.cos(start.h), s.start.y - start.y - n * 345 * Math.sin(start.h)) >
        0.1 ||
      Math.abs(Math.sin(s.start.h - start.h)) > 1e-6 ||
      Math.cos(s.start.h - start.h) < 0
    )
      throw new Error('straightSpace')
  }
  const end = segments[selected + count - 1].end,
    angle = (start.h * 180) / Math.PI + (otherSide ? 180 : 0)
  const assembly = transformFreeParts(
    template,
    template.pieces.map((_, i) => i),
    { degrees: angle, dx: otherSide ? end.x : start.x, dy: otherSide ? end.y : start.y },
  )
  const order = Array.from({ length: count }, (_, i) => (otherSide ? count - 1 - i : i)),
    map = new Map(order.map((i, n) => [i, selected + n]))
  const pieces = plan.pieces.map((p, i) => {
    if (i < selected || i >= selected + count) return p
    const type = assembly.pieces[order[i - selected]].type
    if (p.type === 'Control_unit' && type !== 'Standardgerade') throw new Error('controlUnit')
    return {
      ...p,
      ...assembly.pieces[order[i - selected]],
      level: p.level,
      type: p.type === 'Control_unit' ? p.type : type,
      ...(p.elevation ? { elevation: p.elevation } : {}),
    }
  })
  return validateTrackPlan({
    ...plan,
    pieces,
    measuredLaneLengthsM: null,
    trackExtras: [
      ...(plan.trackExtras || []),
      ...assembly.trackExtras.map((e) => ({ ...e, level: segments[selected].level, anchor: map.get(e.anchor) })),
    ],
    partGroups: {
      groups: [...(plan.partGroups?.groups || []), indices],
      released: (plan.partGroups?.released || []).filter((i) => !indices.includes(i)),
    },
  })
}

// Generated layouts run left-to-right. Verify directed slot routes while every
// other fuel rail is occupied; a fixed crossover alone is never a bypass.
export function independentPitAccess(plan) {
  const segments = traceTrackPlan(plan).segments
  const key = (p) => p.map((n) => Math.round(n * 1000)).join(':')
  const edges = [],
    fuel = []
  function edge(points, blocked = -1) {
    let a = points[0],
      b = points.at(-1)
    if (a[0] > b[0]) [a, b] = [b, a]
    edges.push({ a: key(a), b: key(b), blocked })
    return [key(a), key(b)]
  }
  for (const s of segments) for (const lane of [1, 2]) edge(s.points[lane])
  for (const e of plan.trackExtras || [])
    for (const slot of softyExtraGeometry(e, segments).slots) {
      const index = e.fuelBay ? fuel.length : -1
      const ends = edge(slot, index)
      if (index >= 0) fuel.push(ends)
    }
  const starts = [1, 2].map((i) => key(segments[0].points[i][0]))
  const exits = new Set([1, 2].map((i) => key(segments.at(-1).points[i].at(-1))))
  function reaches(from, targets, allowed) {
    const graph = new Map()
    for (const e of edges)
      if (e.blocked < 0 || e.blocked === allowed) {
        if (!graph.has(e.a)) graph.set(e.a, [])
        graph.get(e.a).push(e.b)
      }
    const seen = new Set(from),
      queue = [...from]
    for (let i = 0; i < queue.length; i++)
      for (const next of graph.get(queue[i]) || [])
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
    return [...targets].some((p) => seen.has(p))
  }
  return fuel.every(([a, b], i) => reaches(starts, new Set([a]), i) && reaches([b], exits, i))
}
