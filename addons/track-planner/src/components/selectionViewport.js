import { traceTrackPlan, borderShapes, softyExtraGeometry } from '@racehubos/shared'
import { roadPolygon } from '../../../../vendor/racehubos/shared/src/trackBorderGeometry.js'
import { unitHousingPolygon } from '../../../../vendor/racehubos/shared/src/trackUnitGeometry.js'
export function selectedTrackBounds(plan, railIndices = [], extraIndices = []) {
  if (!railIndices.length && !extraIndices.length) return null
  const segments = traceTrackPlan(plan).segments,
    selected = new Set(railIndices)
  const extras = [
    ...new Set([
      ...extraIndices,
      ...(plan.trackExtras || []).flatMap((e, i) => (!e.hidden && selected.has(e.anchor) ? [i] : [])),
    ]),
  ]
  const points = [
    ...segments.filter((s) => selected.has(s.index)).flatMap((s) => [...roadPolygon(s), ...unitHousingPolygon(s)]),
    ...borderShapes(plan, segments)
      .filter((s) => selected.has(s.index))
      .flatMap((s) => s.points),
    ...extras.flatMap((i) => (plan.trackExtras?.[i] ? softyExtraGeometry(plan.trackExtras[i], segments).polygon : [])),
  ]
  if (!points.length) return null
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]),
    x = Math.min(...xs),
    y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, depth: Math.max(...ys) - y }
}
