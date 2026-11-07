import { borderArticle, pitBorderSideBlocked, borderEndConnections, validateTrackPlan } from '@racehubos/shared'
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
