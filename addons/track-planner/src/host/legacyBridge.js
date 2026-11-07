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
  if (!plan.roomPlan && !hasScene) return plan
  return {
    ...plan,
    pit: {
      ...plan.pit,
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
  const { plannerRoomV1, plannerSceneV1: scene, ...pit } = value.pit
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
