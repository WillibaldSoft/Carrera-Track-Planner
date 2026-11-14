import { buildTrackElevationModel } from './trackElevationModel.js'
import { DEFAULT_RAMPS } from './rampProfiles.js'

// Quintic ramps reach 1.875 times their average grade at the midpoint.
export function suggestRampLengths(plan, targetPercent = 15) {
  const targets = typeof targetPercent === 'number' ? { ascent: targetPercent, descent: targetPercent } : targetPercent
  if (!targets || [targets.ascent, targets.descent].some((n) => !Number.isFinite(n) || n < 1 || n > 100))
    throw new Error('Invalid gradient')
  const current = buildTrackElevationModel(plan)
  const settings = { ...DEFAULT_RAMPS, ...plan.sceneRamps }
  const custom = plan.pieces.some((p) => p.elevation)
  for (const [up, key] of [
    [true, 'ascentLengthMm'],
    [false, 'descentLengthMm'],
  ]) {
    const ramps = current.ramps.filter((r) => r.up === up)
    if (ramps.length)
      settings[key] = Math.max(
        100,
        Math.min(
          20000,
          Math.ceil((Math.max(...ramps.map((r) => r.riseMm)) * 187.5) / targets[up ? 'ascent' : 'descent']),
        ),
      )
  }
  const proposed = buildTrackElevationModel({ ...plan, sceneRamps: settings })
  const directions = [true, false].flatMap((up) => {
    const ramps = proposed.ramps.filter((r) => r.up === up)
    if (!ramps.length) return []
    const peak = (model) =>
      Math.max(
        0,
        ...model.metrics
          .filter((m) => (up ? m.peakPercent > 0 : m.peakPercent < 0))
          .map((m) => Math.abs(m.peakPercent)),
      )
    return [
      {
        up,
        key: up ? 'ascentLengthMm' : 'descentLengthMm',
        lengthMm: Math.min(...ramps.map((r) => r.lengthMm)),
        currentMaxPercent: peak(current),
        maxPercent: peak(proposed),
        rails: proposed.metrics
          .filter((m) => (up ? m.peakPercent > 1e-6 : m.peakPercent < -1e-6))
          .map((m) => m.index + 1),
        limited: ramps.some(
          (r) => r.clipped || r.maxPercent === null || r.maxPercent > targets[up ? 'ascent' : 'descent'] + 0.01,
        ),
      },
    ]
  })
  return { settings, directions, custom }
}
