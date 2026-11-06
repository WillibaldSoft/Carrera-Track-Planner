import {
  enableFreePlacement,
  traceTrackPlan,
  analyseTrackConnections,
  freeTrackSelection,
  extraWorldPose,
  transformFreeParts,
} from '@racehubos/shared'
import { prepareIndividualPitParts, updatePitPartWorld } from './pitPartEditing.js'
import { drivingDirections } from './trackDrivingDirection.js'
export function dockingFrame(input, ref) {
  const segments = traceTrackPlan(input).segments
  if (ref?.kind === 'rail' && segments[ref.index]) {
    const s = segments[ref.index],
      reverse = drivingDirections(input, segments).get(ref.index) === true
    const p = reverse ? s.end : s.start
    return { x: p.x, y: p.y, h: p.h + (reverse ? Math.PI : 0), level: s.level, width: 198 }
  }
  const e = ref?.kind === 'extra' ? input.trackExtras?.[ref.index] : null
  if (!e || !['single', 'pitEntry', 'pitExit'].includes(e.kind)) throw new Error('selectParts')
  const p = extraWorldPose(e, segments),
    h = (p.headingDegrees * Math.PI) / 180 + (e.kind === 'single' ? 0 : Math.PI)
  return {
    x: p.xMm - Math.cos(h) * 172.5,
    y: p.yMm - Math.sin(h) * 172.5,
    h,
    level: segments[e.anchor]?.level ?? e.level,
    width: e.kind === 'single' ? 99 : 198,
  }
}
function connectedSection(plan, index) {
  const graph = analyseTrackConnections(traceTrackPlan(plan).segments),
    seen = new Set(),
    todo = [index]
  while (todo.length) {
    const i = todo.pop()
    if (seen.has(i)) continue
    seen.add(i)
    for (const end of [0, 1]) if (graph.links[i * 2 + end] >= 0) todo.push(Math.floor(graph.links[i * 2 + end] / 2))
    for (const j of freeTrackSelection(plan, i)) if (!seen.has(j)) todo.push(j)
  }
  return [...seen]
}
export function parallelDockingPreview(
  input,
  fixed,
  moving,
  { side = 'right', distanceMm = 198, opposite = false } = {},
) {
  const plan = enableFreePlacement(prepareIndividualPitParts(input))
  if (!fixed || !moving || JSON.stringify(fixed) === JSON.stringify(moving)) throw new Error('selectParts')
  if (!['left', 'right'].includes(side) || !Number.isFinite(distanceMm) || distanceMm < 1 || distanceMm > 10000)
    throw new Error('distance')
  const a = dockingFrame(plan, fixed),
    b = dockingFrame(plan, moving)
  if (a.level !== b.level) throw new Error('levels')
  const offset = distanceMm * (side === 'right' ? 1 : -1),
    h = a.h + (opposite ? Math.PI : 0)
  const target = { x: a.x - Math.sin(a.h) * offset, y: a.y + Math.cos(a.h) * offset, h }
  let result,
    movingIndices = [],
    extraIndices = []
  if (moving.kind === 'rail') {
    movingIndices = connectedSection(plan, moving.index)
    if (movingIndices.some((i) => plan.pieces[i].type === 'Control_unit')) throw new Error('cuFixed')
    if (fixed.kind === 'rail' && movingIndices.includes(fixed.index)) throw new Error('sameSection')
    if (fixed.kind === 'extra' && movingIndices.includes(plan.trackExtras[fixed.index].anchor))
      throw new Error('sharedCarrier')
    result = transformFreeParts(plan, movingIndices, {
      degrees: ((h - b.h) * 180) / Math.PI,
      pivotX: b.x,
      pivotY: b.y,
      dx: target.x - b.x,
      dy: target.y - b.y,
    })
    extraIndices = (plan.trackExtras || []).flatMap((e, i) => (movingIndices.includes(e.anchor) ? [i] : []))
  } else {
    result = updatePitPartWorld(plan, moving.index, {
      xMm: target.x + Math.cos(h) * 172.5,
      yMm: target.y + Math.sin(h) * 172.5,
      headingDegrees: (h * 180) / Math.PI - (plan.trackExtras[moving.index].kind === 'single' ? 0 : 180),
    })
    extraIndices = [moving.index]
  }
  return { plan: result, movingIndices, extraIndices, fixed: a, target, distanceMm }
}
