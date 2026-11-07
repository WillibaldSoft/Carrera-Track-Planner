import { validateTrackPlan } from '@racehubos/shared'
// Native pit pieces use a centred local frame. The shaped 20602 shoulder
// follows the outside of the lane transition, 99 mm above that frame.
export function pitShoulderOptions(plan, index, includeAttached = false) {
  const rail = plan.trackExtras?.[index]
  if (!rail || !['single', 'pitEntry', 'pitExit'].includes(rail.kind)) return []
  return (rail.kind === 'single' ? ['left', 'right'] : ['right']).flatMap((side) => {
    const kind =
      rail.kind === 'single' ? 'borderStandard' : rail.kind === 'pitEntry' ? 'pitBorderEntry' : 'pitBorderExit'
    const h = (rail.placement.headingDegrees * Math.PI) / 180
    const dy = side === 'left' ? 99 : -99
    const placement = {
      ...rail.placement,
      xMm: rail.placement.xMm - Math.sin(h) * dy,
      yMm: rail.placement.yMm + Math.cos(h) * dy,
    }
    const exists = plan.trackExtras.some(
      (e) =>
        e.kind === kind &&
        e.anchor === rail.anchor &&
        e.level === rail.level &&
        Math.hypot(e.placement.xMm - placement.xMm, e.placement.yMm - placement.yMm) < 0.01 &&
        Math.abs(e.placement.headingDegrees - placement.headingDegrees) < 0.01,
    )
    return exists && !includeAttached
      ? []
      : [
          {
            side,
            article: rail.kind === 'single' ? '20560' : '20602',
            extra: {
              kind,
              placement,
              ...(rail.anchor !== undefined ? { anchor: rail.anchor } : {}),
              level: rail.level,
              paintOrder: rail.paintOrder ?? 0,
              ...(rail.drawLayer !== undefined ? { drawLayer: rail.drawLayer } : {}),
            },
          },
        ]
  })
}
export function attachPitShoulder(plan, index, side) {
  const option = pitShoulderOptions(plan, index).find((o) => o.side === side)
  return !option || plan.trackExtras.length >= 3000
    ? plan
    : validateTrackPlan({ ...plan, trackExtras: [...plan.trackExtras, option.extra] })
}

export function attachedPitShoulderIndices(plan, index) {
  return pitShoulderOptions(plan, index, true).flatMap((option) =>
    plan.trackExtras.flatMap((e, i) =>
      e.kind === option.extra.kind &&
      e.anchor === option.extra.anchor &&
      e.level === option.extra.level &&
      Math.hypot(e.placement.xMm - option.extra.placement.xMm, e.placement.yMm - option.extra.placement.yMm) < 0.01 &&
      Math.abs(e.placement.headingDegrees - option.extra.placement.headingDegrees) < 0.01
        ? [i]
        : [],
    ),
  )
}
