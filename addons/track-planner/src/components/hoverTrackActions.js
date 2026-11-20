import { traceTrackPlan, analyseTrackConnections, trackSelection, editFreeParts, transformFreeParts, borderArticle, pitBorderSideBlocked, validateTrackPlan } from '@racehubos/shared'
import { attachAutomaticBorders } from './automaticAttachments.js'
import { drivingDirections } from './trackDrivingDirection.js'

export function trackExtensionOptions(plan, index) {
  if (!plan.pieces[index]) return null
  const segments = traceTrackPlan(plan).segments
  const { links } = analyseTrackConnections(segments)
  const selection = trackSelection(plan, index)
  const first = selection[0], last = selection.at(-1)
  const grouped = !!plan.partGroups?.groups.some((group) => group.some((i) => selection.includes(i)))
  const reverse = drivingDirections(plan, segments, links).get(index) ?? false
  const option = (before) => ({
    action: before ? 'before' : 'after',
    port: before ? segments[first].start : segments[last].end,
    available: !grouped && links[(before ? first : last) * 2 + (before ? 0 : 1)] < 0 && plan.pieces.length + selection.length <= 2000,
    reason: grouped ? 'grouped' : links[(before ? first : last) * 2 + (before ? 0 : 1)] >= 0 ? 'connected' : plan.pieces.length + selection.length > 2000 ? 'limit' : null,
  })
  return { forward: option(reverse), backward: option(!reverse), reverse, types: selection.map((i) => plan.pieces[i].type) }
}

export function extendHoveredTrack(plan, index, direction) {
  const options = trackExtensionOptions(plan, index)
  const option = options?.[direction]
  if (!option?.available) return null
  const result = editFreeParts(plan, index, option.action, options.types)
  const inserted = trackSelection(result.plan, result.selected)
  if (option.action === 'before') {
    // Curves need their outgoing heading aligned, as well as their endpoint.
    const end = traceTrackPlan(result.plan).segments[inserted.at(-1)].end
    result.plan = transformFreeParts(result.plan, inserted, {
      degrees: (option.port.h - end.h) * 180 / Math.PI,
      pivotX: end.x, pivotY: end.y,
      dx: option.port.x - end.x, dy: option.port.y - end.y,
    })
  }
  return { ...result, count: options.types.length }
}

export function hoveredShoulderStatus(plan, index, side, reverse = false) {
  const piece = plan.pieces[index]
  if (!piece) return { available: false, reason: 'unsupported' }
  const physicalSide = reverse ? (side === 'left' ? 'right' : 'left') : side
  if (piece.borders?.[physicalSide]) return { available: true, reason: null, mode: 'remove', physicalSide }
  const reason = physicalSide === 'left' && ['Control_unit', 'AdapterUnit'].includes(piece.type) ? 'unit'
    : !borderArticle(piece.type, physicalSide) ? 'unsupported'
    : pitBorderSideBlocked(plan, index, physicalSide) ? 'pit' : null
  return { available: !reason, reason, mode: 'add', physicalSide }
}

// Hover and click use the same calculation; hovering never changes the source plan.
export function previewHoveredTrackAction(plan, index, action) {
  const options = trackExtensionOptions(plan, index)
  if (!options) return null
  if (action === 'left' || action === 'right') {
    const status = hoveredShoulderStatus(plan, index, action, options.reverse)
    if (!status.available) return null
    if (status.mode === 'remove') {
      const next = validateTrackPlan({ ...plan, pieces: plan.pieces.map((piece, i) => {
        if (i !== index) return piece
        const borders = { ...piece.borders }
        delete borders[status.physicalSide]
        const { borders: previous, ...rest } = piece
        return Object.keys(borders).length ? { ...rest, borders } : rest
      }) })
      return { plan: next, selected: index, count: 0, mode: 'remove' }
    }
    const next = attachAutomaticBorders(plan, index, action, options.reverse)
    return next === plan ? null : { plan: next, selected: index, count: 0, mode: 'add' }
  }
  return extendHoveredTrack(plan, index, action)
}

// Only show the next side controls on physically connected rails, not array neighbours.
export function shoulderFlowNeighbours(plan, index, visibleIndices = null) {
  if (!plan.pieces[index]) return []
  const { links } = analyseTrackConnections(traceTrackPlan(plan).segments)
  return [...new Set([links[index * 2], links[index * 2 + 1]]
    .filter((port) => port >= 0).map((port) => Math.floor(port / 2)))]
    .filter((i) => i !== index && (!visibleIndices || visibleIndices.includes(i)))
}

export function hoverActionHandles(plan, index, width, viewportWidth, flowSide = null, visibleIndices = null) {
  const segments = traceTrackPlan(plan).segments
  const radius = Math.max(22, width / viewportWidth * 16)
  const indices = [index, ...(flowSide ? shoulderFlowNeighbours(plan, index, visibleIndices) : [])]
  return indices.flatMap((railIndex) => {
    const options = trackExtensionOptions(plan, railIndex), segment = segments[railIndex]
    if (!options || !segment) return []
    const cx = (segment.start.x + segment.end.x) / 2, cy = (segment.start.y + segment.end.y) / 2
    const heading = (segment.start.h + segment.end.h) / 2 + (options.reverse ? Math.PI : 0)
    return (railIndex === index ? ['forward', 'backward', 'left', 'right'] : [flowSide]).map((action) => {
      const along = action === 'forward' || action === 'backward', option = options[action]
      const angle = along ? option.port.h + (option.action === 'before' ? Math.PI : 0)
        : heading + (action === 'left' ? -Math.PI / 2 : Math.PI / 2)
      const offset = along ? radius * 1.6 : 110 + radius
      const status = along ? option : hoveredShoulderStatus(plan, railIndex, action, options.reverse)
      return { index: railIndex, action, angle, radius, x: (along ? option.port.x : cx) + Math.cos(angle) * offset,
        y: (along ? option.port.y : cy) + Math.sin(angle) * offset, enabled: status.available, reason: status.reason, mode: status.mode }
    })
  })
}

export function applyShoulderStrokeStep(plan, index, side, mode) {
  const reverse = trackExtensionOptions(plan, index)?.reverse ?? false
  const status = hoveredShoulderStatus(plan, index, side, reverse)
  if (!status.available || status.mode !== mode) return plan
  return previewHoveredTrackAction(plan, index, side)?.plan ?? plan
}

export function shoulderStrokeTargets(plan, width, viewportWidth, visibleIndices) {
  const segments = traceTrackPlan(plan).segments, directions = drivingDirections(plan, segments)
  const radius = Math.max(22, width / viewportWidth * 16)
  return segments.filter((s) => visibleIndices.includes(s.index)).flatMap((s) => ['left', 'right'].map((action) => {
    const h = (s.start.h + s.end.h) / 2 + (directions.get(s.index) ? Math.PI : 0) + (action === 'left' ? -Math.PI / 2 : Math.PI / 2)
    return { index: s.index, action, x: (s.start.x + s.end.x) / 2 + Math.cos(h) * (110 + radius),
      y: (s.start.y + s.end.y) / 2 + Math.sin(h) * (110 + radius), radius: Math.max(radius * 1.5, width / viewportWidth * 24) }
  }))
}

// Test the entire pointer path so quick movement cannot skip a side arrow.
export function crossedShoulderTargets(targets, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, length2 = dx * dx + dy * dy
  return targets.map((target) => {
    const t = length2 ? Math.max(0, Math.min(1, ((target.x - from.x) * dx + (target.y - from.y) * dy) / length2)) : 0
    return { target, t, distance: Math.hypot(target.x - from.x - t * dx, target.y - from.y - t * dy) }
  }).filter(({ target, distance }) => distance <= target.radius).sort((a, b) => a.t - b.t).map(({ target }) => target)
}
