import { usePlannerUpdates } from './updates/UpdateContext'
import { prepareIndividualPitParts } from './components/pitPartEditing'
import { useEffect, useState, useRef } from 'react'
import i18n from './i18n'
import { connectLegacyHost } from './host/legacyBridge'
import TrackPlanEditor from './components/TrackPlanEditor'
const targetOrigin = new URLSearchParams(window.location.hash.slice(1)).get('host') || window.location.origin
export default function EmbeddedPlanner({ connectHost = connectLegacyHost } = {}) {
  const updater = usePlannerUpdates()
  const latestDraft = useRef(null)
  const [baseline, setBaseline] = useState(null)
  const bridge = useRef(null)
  const [draft, setDraft] = useState(null)
  const [status, setStatus] = useState({})
  useEffect(() => {
    bridge.current = connectHost({
      surface: window,
      origin: targetOrigin,
      onInitialize({ draft, language, dark }) {
        i18n.changeLanguage(language)
        document.documentElement.classList.toggle('dark', dark)
        const next = { ...draft, plan: prepareIndividualPitParts(draft.plan) }
        latestDraft.current = next
        setDraft(next)
        setBaseline(JSON.stringify({ name: next.name, plan: next.plan }))
      },
      onStatus(next) {
        setStatus(next)
        if (next.success && !next.saving && latestDraft.current) {
          const current = latestDraft.current
          setBaseline(JSON.stringify({ name: current.name, plan: current.plan }))
        }
      },
    })
    return () => {
      bridge.current?.dispose()
      bridge.current = null
    }
  }, [connectHost])
  useEffect(() => {
    updater?.setDirty(!!draft && baseline !== JSON.stringify({ name: draft.name, plan: draft.plan }))
  }, [draft, baseline])
  function send(type, next = draft) {
    bridge.current?.send(type, next)
  }
  function update(patch) {
    const next = { ...draft, ...patch }
    latestDraft.current = next
    setDraft(next)
    send('change', next)
  }
  if (!draft) return null
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        send('save')
      }}
    >
      <TrackPlanEditor
        value={draft.plan}
        trackName={draft.name}
        onChange={(plan) => update({ plan })}
        onNameChange={(name) => update({ name })}
        onImportNew={(name) => {
          setDraft((previous) => {
            const next = { ...previous, name, importAsNew: true }
            latestDraft.current = next
            send('change', next)
            return next
          })
        }}
        expanded
        onExpandedChange={() => {}}
        onCancel={() => send('cancel')}
        saving={status.saving}
        statusError={status.error}
        statusSuccess={status.success}
      />
    </form>
  )
}
