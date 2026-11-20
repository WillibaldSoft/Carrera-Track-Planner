import { traceTrackPlan } from '@racehubos/shared'

// Keep the replacement area away from both joints, where the user wants to dock.
export function replacementTargetAt(plan, point, visibleIndices = null) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return -1
  let target = -1, nearest = Infinity
  for (const segment of traceTrackPlan(plan).segments) {
    if (visibleIndices && !visibleIndices.includes(segment.index)) continue
    const { start, end } = segment
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    const distance = Math.hypot(point.x - (start.x + end.x) / 2, point.y - (start.y + end.y) / 2)
    if (distance <= Math.min(65, length * .23) && distance < nearest) {
      target = segment.index
      nearest = distance
    }
  }
  return target
}
