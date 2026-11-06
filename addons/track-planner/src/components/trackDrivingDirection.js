import { traceTrackPlan, analyseTrackConnections } from '@racehubos/shared'
export function drivingDirections(
  plan,
  segments = traceTrackPlan(plan).segments,
  links = analyseTrackConnections(segments).links,
) {
  const directions = new Map()
  for (const cu of segments.filter((s) => s.type === 'Control_unit')) {
    if (directions.has(cu.index)) continue
    directions.set(cu.index, false)
    for (const backwards of [false, true]) {
      let exit = cu.index * 2 + (backwards ? 0 : 1)
      const seen = new Set([cu.index])
      while (links[exit] >= 0) {
        const port = links[exit],
          index = Math.floor(port / 2),
          reverse = port % 2 === 1
        if (seen.has(index)) break
        seen.add(index)
        if (!directions.has(index)) directions.set(index, backwards ? !reverse : reverse)
        exit = index * 2 + (reverse ? 0 : 1)
      }
    }
  }
  return directions
}
