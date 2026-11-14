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

// Move a smooth ramp without changing its grade, length or fixed crossings.
export function shiftRampArea(plan, up, deltaMm) {
  if (!Number.isFinite(deltaMm) || deltaMm === 0 || plan.pieces.some((p) => p.elevation)) return null
  const key = up ? 'ascentShiftMm' : 'descentShiftMm'
  const before = buildTrackElevationModel(plan)
  const value = (plan.sceneRamps?.[key] || 0) + deltaMm
  if (Math.abs(value) > 20000) return null
  const next = { ...plan, sceneRamps: { ...DEFAULT_RAMPS, ...plan.sceneRamps, [key]: value } }
  const after = buildTrackElevationModel(next)
  const oldRamps = before.ramps.filter((r) => r.up === up),
    newRamps = after.ramps.filter((r) => r.up === up)
  if (!oldRamps.length || newRamps.length !== oldRamps.length) return null
  if (
    newRamps.some(
      (r, i) =>
        Math.abs(r.lengthMm - oldRamps[i].lengthMm) > 0.01 ||
        r.maxPercent > oldRamps[i].maxPercent + 0.01 ||
        Math.abs((r.appliedShiftMm || 0) - (oldRamps[i].appliedShiftMm || 0) - deltaMm) > 0.01,
    )
  )
    return null
  if (
    after.crossingMeasures.some((c) => {
      const old = before.crossingMeasures.find((b) => b.number === c.number)
      return old && c.clearanceMm < old.clearanceMm - 0.01
    })
  )
    return null
  if (
    !after.heights.some((h, i) => [0, 0.5, 1].some((t) => Math.abs(h.sample(t) - before.heights[i].sample(t)) > 0.001))
  )
    return null
  return next
}

// Preserve the fractional start position while moving to an adjacent rail.
// Curves and fractional straights therefore use their actual centreline length.
export function shiftRampAreaByParts(plan, up, count) {
  if (!Number.isInteger(count) || !count || Math.abs(count) > 10) return null
  const ramp = buildTrackElevationModel(plan).ramps.find((r) => r.up === up)
  if (!ramp?.chainBoundariesMm) return null
  const positions = ramp.chainBoundariesMm,
    start = ramp.startAlongMm
  const index = positions.findIndex(
    (p, i) => i < positions.length - 1 && start >= p - 1e-6 && start < positions[i + 1] - 1e-6,
  )
  const target = index + count
  if (index < 0 || target < 0 || target >= positions.length - 1) return null
  const fraction = (start - positions[index]) / (positions[index + 1] - positions[index])
  const to = positions[target] + fraction * (positions[target + 1] - positions[target])
  return shiftRampArea(plan, up, to - start)
}
