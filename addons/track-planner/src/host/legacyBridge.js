import { readTrackPlan } from '@racehubos/shared'
export const LEGACY_CHANNEL = 'racehubos:track-planner:1'

// Older hosts discard newer top-level and per-rail fields, while native pit
// metadata remains extensible. Keep snapshots only at this legacy boundary;
// the editor and native export retain the normal validated plan schema.
const sceneKeys = ['sceneHeights', 'sceneRamps', 'showElevationLabels']
const railKeys = ['elevation', 'heightLabelOffset']
const pick = (value, keys) => Object.fromEntries(keys.filter((k) => value[k] !== undefined).map((k) => [k, value[k]]))
export function encodeLegacyRoom(plan) {
  if (!plan) return plan
  const hasScene =
    sceneKeys.some((k) => plan[k] !== undefined) || plan.pieces.some((p) => railKeys.some((k) => p[k] !== undefined))
  const forcedRails = plan.pieces.flatMap((p, index) =>
    p.type === 'Spurwechsel_20517' ? [{ index, type: p.type }] : [],
  )
  const extraKinds = (plan.trackExtras || []).flatMap((e, index) =>
    e.kind === 'fixedCross' ? [{ index, kind: e.kind }] : [],
  )
  if (!plan.roomPlan && !hasScene && !forcedRails.length && !extraKinds.length) return plan
  return {
    ...plan,
    ...(extraKinds.length
      ? {
          trackExtras: plan.trackExtras.map((e) =>
            e.kind === 'fixedCross' ? { ...e, kind: 'single', fuelBay: false } : e,
          ),
        }
      : {}),
    pieces: plan.pieces.map((p) => (p.type === 'Spurwechsel_20517' ? { ...p, type: 'Standardgerade' } : p)),
    pit: {
      ...plan.pit,
      ...(extraKinds.length ? { plannerExtraKindsV1: { version: 1, extras: extraKinds } } : {}),
      ...(forcedRails.length ? { plannerRailTypesV1: { version: 1, rails: forcedRails } } : {}),
      ...(plan.roomPlan ? { plannerRoomV1: plan.roomPlan } : {}),
      ...(hasScene
        ? {
            plannerSceneV1: {
              version: 1,
              ...pick(plan, sceneKeys),
              pieces: plan.pieces.map((p) => ({ type: p.type, ...pick(p, railKeys) })),
            },
          }
        : {}),
    },
  }
}
export function decodeLegacyRoom(value) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!value?.pit) return readTrackPlan(value)
  const {
    plannerRoomV1,
    plannerSceneV1: scene,
    plannerRailTypesV1: types,
    plannerExtraKindsV1: kinds,
    ...pit
  } = value.pit
  if (kinds) {
    if (
      kinds.version !== 1 ||
      !Array.isArray(kinds.extras) ||
      !Array.isArray(value.trackExtras) ||
      kinds.extras.length > value.trackExtras.length ||
      new Set(kinds.extras.map((e) => e?.index)).size !== kinds.extras.length ||
      kinds.extras.some(
        (e) =>
          !e ||
          !Number.isInteger(e.index) ||
          e.index < 0 ||
          e.kind !== 'fixedCross' ||
          value.trackExtras[e.index]?.kind !== 'single',
      )
    )
      return null
    const restored = new Set(kinds.extras.map((e) => e.index))
    value = {
      ...value,
      trackExtras: value.trackExtras.map((e, i) => {
        if (!restored.has(i)) return e
        const { fuelBay, ...part } = e
        return { ...part, kind: 'fixedCross' }
      }),
    }
  }
  if (types) {
    if (
      types.version !== 1 ||
      !Array.isArray(types.rails) ||
      !Array.isArray(value.pieces) ||
      types.rails.length > value.pieces.length ||
      new Set(types.rails.map((p) => p?.index)).size !== types.rails.length ||
      types.rails.some(
        (p) =>
          !p ||
          !Number.isInteger(p.index) ||
          p.index < 0 ||
          p.type !== 'Spurwechsel_20517' ||
          value.pieces[p.index]?.type !== 'Standardgerade',
      )
    )
      return null
    const rails = new Map(types.rails.map((p) => [p.index, p.type]))
    value = { ...value, pieces: value.pieces.map((p, i) => (rails.has(i) ? { ...p, type: rails.get(i) } : p)) }
  }
  if (
    scene &&
    (scene.version !== 1 ||
      !Array.isArray(scene.pieces) ||
      !Array.isArray(value.pieces) ||
      scene.pieces.length !== value.pieces.length ||
      scene.pieces.some((p, i) => !p || p.type !== value.pieces[i]?.type))
  )
    return null
  return readTrackPlan({
    ...value,
    pit,
    ...(plannerRoomV1 ? { roomPlan: plannerRoomV1 } : {}),
    ...(scene
      ? {
          ...pick(scene, sceneKeys),
          pieces: value.pieces.map((p, i) => ({ ...p, ...pick(scene.pieces[i], railKeys) })),
        }
      : {}),
  })
}

// Compatibility adapter for the current experimental integration. This is not
// Anselme's future plugin API; the editor only depends on this small interface.
export function connectLegacyHost({ surface, origin, onInitialize, onStatus }) {
  function receive(event) {
    if (event.source !== surface.parent || event.origin !== origin || event.data?.channel !== LEGACY_CHANNEL) return
    const message = event.data
    if (message.type === 'init') {
      const draft = message.draft
      const plan = decodeLegacyRoom(draft?.plan)
      if (!plan || typeof draft.name !== 'string' || draft.name.length > 150) return
      onInitialize({
        draft: { plan, name: draft.name, importAsNew: !!draft.importAsNew },
        language: ['de', 'en', 'fr'].includes(message.language) ? message.language : 'en',
        dark: message.dark === true,
      })
    }
    if (message.type === 'status' && message.status && typeof message.status === 'object')
      onStatus({
        saving: message.status.saving === true,
        error: typeof message.status.error === 'string' ? message.status.error : '',
        success: typeof message.status.success === 'string' ? message.status.success : '',
      })
  }
  surface.addEventListener('message', receive)
  surface.parent.postMessage({ channel: LEGACY_CHANNEL, type: 'ready' }, origin)
  return {
    send(type, draft) {
      if (!['change', 'save', 'cancel'].includes(type)) throw new Error('Unsupported legacy message')
      surface.parent.postMessage(
        { channel: LEGACY_CHANNEL, type, draft: draft ? { ...draft, plan: encodeLegacyRoom(draft.plan) } : draft },
        origin,
      )
    },
    dispose() {
      surface.removeEventListener('message', receive)
    },
  }
}
