import { attachedPitShoulderIndices } from './pitShoulders.js'
import {
  validateTrackPlan,
  traceTrackPlan,
  editablePitlane,
  extraWorldPose,
  nativeFuelBayIndices,
} from '@racehubos/shared'
const kinds = new Set(['single', 'pitEntry', 'pitExit'])
const degrees = (a) => ((((a + 180) % 360) + 360) % 360) - 180
// One-time editor migration. Native format v1 preserves optional pit metadata;
// positions and fuel/AKS metadata are retained. Later explicit groups stay valid.
export function prepareIndividualPitParts(input) {
  if (!input) return input
  const previousReleased = new Set(input.partGroups?.released || [])
  const existingCarriers = (input.trackExtras || [])
    .filter((e) => kinds.has(e.kind))
    .map((e) => e.anchor)
    .filter(Number.isInteger)
  if (input.pit?.individualParts === true && existingCarriers.every((i) => previousReleased.has(i))) return input
  if (!input.pit?.enabled && !(input.trackExtras || []).some((e) => kinds.has(e.kind))) return input
  let plan = editablePitlane(input).plan
  const carriers = new Set(
    (plan.trackExtras || [])
      .filter((e) => kinds.has(e.kind))
      .map((e) => e.anchor)
      .filter(Number.isInteger),
  )
  if (plan.pit.enabled) {
    for (let i = plan.pit.entry, n = 0; n < plan.pieces.length; n++, i = (i + 1) % plan.pieces.length) {
      carriers.add(i)
      if (i === plan.pit.merge) break
    }
  }
  const state = plan.partGroups || { groups: [], released: [] }
  const pending = input.pit?.individualParts ? new Set([...carriers].filter((i) => !previousReleased.has(i))) : carriers
  for (const group of state.groups) if (group.some((i) => pending.has(i))) for (const i of group) pending.add(i)
  const fuel = new Set(nativeFuelBayIndices(plan, traceTrackPlan(plan).segments))
  const inheritedAks = new Map()
  const transferredCarriers = new Set()
  for (const [i, e] of (plan.trackExtras || []).entries()) {
    const carrier = plan.pieces[e.anchor]
    if (
      ['pitEntry', 'pitExit'].includes(e.kind) &&
      e.antiCollision === undefined &&
      carrier?.antiCollision !== undefined &&
      Math.abs(e.placement.xMm - 172.5) < 1 &&
      Math.abs(e.placement.yMm - 99) < 1
    ) {
      inheritedAks.set(i, carrier.antiCollision)
      transferredCarriers.add(e.anchor)
    }
  }
  return validateTrackPlan({
    ...plan,
    pit: { ...plan.pit, individualParts: true },
    pieces: plan.pieces.map((p, i) => {
      if (!transferredCarriers.has(i)) return p
      const { antiCollision, ...rest } = p
      void antiCollision
      return rest
    }),
    partGroups: {
      groups: state.groups.map((g) => g.filter((i) => !pending.has(i))).filter((g) => g.length > 1),
      released: [...new Set([...state.released, ...pending])].sort((a, b) => a - b),
    },
    trackExtras: (plan.trackExtras || []).map((e, i) =>
      e.kind === 'single'
        ? { ...e, fuelBay: e.fuelBay ?? fuel.has(i) }
        : inheritedAks.has(i)
          ? { ...e, antiCollision: inheritedAks.get(i) }
          : e,
    ),
  })
}
export function updatePitPartWorld(input, index, patch) {
  const plan = prepareIndividualPitParts(input),
    extra = plan.trackExtras?.[index]
  if (!extra || !kinds.has(extra.kind)) throw new Error('Select an individual pit part')
  const segments = traceTrackPlan(plan).segments,
    old = extraWorldPose(extra, segments)
  let anchor = Object.hasOwn(patch, 'anchor') ? patch.anchor : extra.anchor
  if (anchor !== undefined && (!Number.isInteger(anchor) || !segments[anchor])) throw new Error('Invalid pit carrier')
  if (patch.level !== undefined && anchor !== undefined && patch.level !== segments[anchor].level) anchor = undefined
  const pose = {
    xMm: patch.xMm ?? old.xMm,
    yMm: patch.yMm ?? old.yMm,
    headingDegrees: degrees(patch.headingDegrees ?? old.headingDegrees),
  }
  const a = segments[anchor]?.start,
    h = a?.h ?? 0,
    c = Math.cos(h),
    s = Math.sin(h)
  const x = pose.xMm - (a?.x ?? 0),
    y = pose.yMm - (a?.y ?? 0)
  const { anchor: unused, ...rest } = extra
  void unused
  const changed = {
    ...rest,
    ...(anchor !== undefined ? { anchor } : {}),
    level: patch.level ?? (anchor === undefined ? extra.level : segments[anchor].level),
    placement: {
      xMm: c * x + s * y,
      yMm: -s * x + c * y,
      headingDegrees: degrees(pose.headingDegrees - (h * 180) / Math.PI),
    },
  }
  const attached = new Set(attachedPitShoulderIndices(plan, index))
  const delta = ((pose.headingDegrees - old.headingDegrees) * Math.PI) / 180
  function moveShoulder(e) {
    const world = extraWorldPose(e, segments),
      dx = world.xMm - old.xMm,
      dy = world.yMm - old.yMm
    const wx = pose.xMm + Math.cos(delta) * dx - Math.sin(delta) * dy
    const wy = pose.yMm + Math.sin(delta) * dx + Math.cos(delta) * dy
    const { anchor: previousAnchor, ...body } = e
    void previousAnchor
    return {
      ...body,
      ...(anchor !== undefined ? { anchor } : {}),
      level: changed.level,
      placement: {
        xMm: c * (wx - (a?.x ?? 0)) + s * (wy - (a?.y ?? 0)),
        yMm: -s * (wx - (a?.x ?? 0)) + c * (wy - (a?.y ?? 0)),
        headingDegrees: degrees(world.headingDegrees + pose.headingDegrees - old.headingDegrees - (h * 180) / Math.PI),
      },
    }
  }
  // Releasing a carrier switch must not resurrect its implicit drawing.
  const releaseCarrier =
    (anchor !== extra.anchor || Math.hypot(pose.xMm - old.xMm, pose.yMm - old.yMm) > 0.001) &&
    ['pitEntry', 'pitExit'].includes(extra.kind) &&
    plan.pieces[extra.anchor]?.type.startsWith('Pit_stop_weiche_') &&
    Math.abs(extra.placement.xMm - 172.5) < 1 &&
    Math.abs(extra.placement.yMm - 99) < 1 &&
    !(plan.trackExtras || []).some((e, i) => {
      if (i === index || !['pitEntry', 'pitExit'].includes(e.kind)) return false
      const p = extraWorldPose(e, segments)
      return Math.hypot(p.xMm - old.xMm, p.yMm - old.yMm) < 1
    })
  return validateTrackPlan({
    ...plan,
    measuredLaneLengthsM: null,
    pieces: plan.pieces.map((p, i) => {
      if (!releaseCarrier || i !== extra.anchor) return p
      const { antiCollision, ...rest } = p
      void antiCollision
      return { ...rest, type: 'Standardgerade' }
    }),
    trackExtras: plan.trackExtras.map((e, i) => (i === index ? changed : attached.has(i) ? moveShoulder(e) : e)),
  })
}
