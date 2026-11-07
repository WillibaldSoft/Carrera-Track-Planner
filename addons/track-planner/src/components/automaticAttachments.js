import {
  borderArticle,
  pitBorderSideBlocked,
  borderEndConnections,
  validateTrackPlan,
  traceTrackPlan,
  analyseTrackConnections,
} from '@racehubos/shared'
export function attachmentOptions(plan, index) {
  const piece = plan.pieces[index]
  if (!piece) return []
  const result = [],
    ports = piece.borders ? borderEndConnections(plan) : []
  for (const side of ['left', 'right']) {
    if (side === 'left' && ['Control_unit', 'AdapterUnit'].includes(piece.type)) continue
    if (!borderArticle(piece.type, side) || pitBorderSideBlocked(plan, index, side)) continue
    if (!piece.borders?.[side]) result.push({ id: side, kind: 'strip', side, article: borderArticle(piece.type, side) })
    else if (!piece.type.startsWith('Steilkurve_'))
      for (const edge of ['startCap', 'endCap']) {
        if (
          !piece.borders[side][edge] &&
          ports.some((p) => p.index === index && p.side === side && p.key === edge && !p.connected)
        )
          result.push({ id: `${side}-${edge}`, kind: edge, side, article: '20598' })
      }
  }
  return result
}
export function attachTrackAccessory(plan, index, id) {
  const option = attachmentOptions(plan, index).find((o) => o.id === id)
  if (!option) return plan
  const pieces = plan.pieces.map((p, i) =>
    i !== index
      ? p
      : {
          ...p,
          borders: {
            ...p.borders,
            [option.side]:
              option.kind === 'strip'
                ? { startCap: false, endCap: false }
                : { ...p.borders[option.side], [option.kind]: true },
          },
        },
  )
  return validateTrackPlan({ ...plan, pieces })
}

// Keep the selected driving side while laying one rail at a time. Existing
// opposite shoulders, heights, caps and drawing metadata are not replaced.
function automaticBorderSides(plan, index, side, reverse) {
  if (!['left', 'right', 'both'].includes(side)) throw new Error('Invalid automatic shoulder side')
  const piece = plan.pieces[index]
  if (!piece) return []
  const physicalSide = reverse && side !== 'both' ? (side === 'left' ? 'right' : 'left') : side
  return ['left', 'right'].filter(
    (s) =>
      (physicalSide === 'both' || physicalSide === s) &&
      !piece.borders?.[s] &&
      !(s === 'left' && ['Control_unit', 'AdapterUnit'].includes(piece.type)) &&
      borderArticle(piece.type, s) &&
      !pitBorderSideBlocked(plan, index, s),
  )
}
export function canAttachAutomaticBorders(plan, index, side = 'both', reverse = false) {
  return automaticBorderSides(plan, index, side, reverse).length > 0
}
export function attachAutomaticBorders(plan, index, side = 'both', reverse = false) {
  const sides = automaticBorderSides(plan, index, side, reverse)
  if (!sides.length) return plan
  const piece = plan.pieces[index]
  const borders = { ...piece.borders }
  for (const s of sides) borders[s] = { startCap: false, endCap: false }
  let next = { ...plan, pieces: plan.pieces.map((p, i) => (i === index ? { ...p, borders } : p)) }
  if (plan.pieces.some((p) => Object.values(p.borders || {}).some((b) => b.startCap || b.endCap))) {
    const ports = borderEndConnections(next),
      added = ports.filter((p) => p.index === index && sides.includes(p.side))
    const joined = ports.filter(
      (p) =>
        p.connected &&
        added.some(
          (q) =>
            q.connected &&
            p.index !== q.index &&
            (p.level === q.level ||
              (!next.freePlacement &&
                ((p.index + 1) % next.pieces.length === q.index || (q.index + 1) % next.pieces.length === p.index))) &&
            Math.hypot(p.x - q.x, p.y - q.y) <= 2 &&
            Math.abs(Math.abs(Math.atan2(Math.sin(p.h - q.h), Math.cos(p.h - q.h))) - Math.PI) <= Math.PI / 180,
        ),
    )
    next = {
      ...next,
      pieces: next.pieces.map((p, i) => {
        const changes = joined.filter((port) => port.index === i && p.borders?.[port.side]?.[port.key])
        if (!changes.length) return p
        const bs = { ...p.borders }
        for (const port of changes) bs[port.side] = { ...bs[port.side], [port.key]: false }
        return { ...p, borders: bs }
      }),
    }
  }
  return validateTrackPlan(next)
}
export function nextAutomaticBorderTarget(plan, index, side = 'both', reverse = false) {
  const { segments } = traceTrackPlan(plan),
    { links } = analyseTrackConnections(segments)
  const visited = new Set([index])
  let current = index,
    backwards = reverse
  while (segments[current]) {
    const next = links[current * 2 + (backwards ? 0 : 1)]
    if (next < 0) return null
    current = Math.floor(next / 2)
    backwards = next % 2 === 1
    if (visited.has(current)) return null
    visited.add(current)
    if (canAttachAutomaticBorders(plan, current, side, backwards)) return { index: current, reverse: backwards }
  }
  return null
}
