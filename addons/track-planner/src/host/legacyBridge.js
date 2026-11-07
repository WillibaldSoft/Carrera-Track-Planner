import { readTrackPlan } from '@racehubos/shared'
export const LEGACY_CHANNEL = 'racehubos:track-planner:1'

// Older hosts validate roomPlan against their rectangular schema. Their existing
// native pit metadata remains extensible. Keep the lossless room snapshot only
// at this legacy boundary; the editor and native export use roomPlan normally.
export function encodeLegacyRoom(plan) {
  return plan?.roomPlan ? { ...plan, pit: { ...plan.pit, plannerRoomV1: plan.roomPlan } } : plan
}
export function decodeLegacyRoom(value) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!value?.pit?.plannerRoomV1) return readTrackPlan(value)
  const { plannerRoomV1, ...pit } = value.pit
  return readTrackPlan({ ...value, pit, roomPlan: plannerRoomV1 })
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
