import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { validateRoom, DEFAULT_ROOM } from '@racehubos/shared'
import { Button } from '@core/components/ui/button'
import { roomFootprint } from './roomBackground'
import RoomFootprintDrawing from './RoomFootprintDrawing'
const KEY = 'carrera-planner-room-templates-v1'
// HTTP access on a local network may not expose the secure-context UUID API.
const newId = () =>
  globalThis.crypto?.randomUUID?.() || `room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
export function loadRoomTemplates() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list)
      ? list.slice(0, 40).filter((r) => {
          try {
            return (
              typeof r.id === 'string' && typeof r.name === 'string' && r.name.length <= 100 && !!validateRoom(r.room)
            )
          } catch {
            return false
          }
        })
      : []
  } catch {
    return []
  }
}
export default function RoomFootprintEditor({ room, onChange, onContinue, references = [] }) {
  const { t } = useTranslation('plannerRoom')
  const [templates, setTemplates] = useState(loadRoomTemplates),
    [template, setTemplate] = useState(''),
    [name, setName] = useState(''),
    [selected, setSelected] = useState(''),
    [error, setError] = useState(''),
    [frozenView, setFrozenView] = useState(null)
  const svg = useRef(null),
    drag = useRef(null)
  const features = room.features || [],
    active = features.find((f) => f.id === selected),
    shape = roomFootprint(room)
  let invalid = false
  try {
    validateRoom(room)
  } catch {
    invalid = true
  }
  const b = shape.bounds,
    pad = 400,
    view = frozenView || [b.x - pad, b.y - pad, b.width + 2 * pad, b.depth + 2 * pad]
  function patch(p) {
    onChange({ ...room, ...p })
    setError('')
  }
  function change(id, p) {
    patch({ features: features.map((f) => (f.id === id ? { ...f, ...p } : f)) })
  }
  function add(kind) {
    const id = newId(),
      f = { id, kind, name: t(kind), widthM: 1, depthM: 0.5, xM: kind === 'extension' ? room.widthM : 0, yM: 0 }
    patch({ features: [...features, f] })
    setSelected(id)
  }
  function point(e) {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current.getScreenCTM().inverse())
    return { x: p.x / 1000, y: p.y / 1000 }
  }
  function choose(id) {
    setTemplate(id)
    setSelected('')
    const entry = [...templates, ...references].find((r) => r.id === id)
    if (entry) {
      const { backgroundOrigin, ...next } = entry.room
      onChange(structuredClone(next))
      setName(entry.name)
    } else {
      setName('')
      onChange({ ...DEFAULT_ROOM, features: [] })
    }
  }
  function proceed() {
    try {
      const value = validateRoom(room),
        id = templates.some((r) => r.id === template) ? template : newId()
      const title = name.trim() || `${t('room')} ${room.widthM} × ${room.depthM} m`
      const next = [{ id, name: title, room: value }, ...templates.filter((r) => r.id !== id)].slice(0, 40)
      localStorage.setItem(KEY, JSON.stringify(next))
      setTemplates(next)
      onContinue(value)
    } catch {
      setError(t('saveError'))
    }
  }
  return (
    <section className="planner-room-shape space-y-3" data-testid="room-footprint-editor">
      <h3>{t('step')}</h3>
      <p>{t('intro')}</p>
      <div className="grid grid-cols-2 gap-2">
        <label>
          {t('choose')}
          <select data-testid="room-template-select" value={template} onChange={(e) => choose(e.target.value)}>
            <option value="">{t('new')}</option>
            {[...templates, ...references].map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('name')}
          <input
            data-testid="room-template-name"
            maxLength="100"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      </div>
      <p className="text-xs">{t('storage')}</p>
      <div className="grid grid-cols-2 gap-2">
        {['widthM', 'depthM'].map((key) => (
          <label key={key}>
            {t(key)}
            <input
              data-testid={`room-${key}`}
              type="number"
              min="1"
              max="30"
              step="0.01"
              value={room[key]}
              onChange={(e) => patch({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          data-testid="room-add-obstacle"
          type="button"
          variant="outline"
          disabled={features.length >= 32}
          onClick={() => add('obstacle')}
        >
          {t('addObstacle')}
        </Button>
        <Button
          data-testid="room-add-extension"
          type="button"
          variant="outline"
          disabled={features.length >= 32}
          onClick={() => add('extension')}
        >
          {t('addExtension')}
        </Button>
      </div>
      <p>{t('dragNote')}</p>
      <svg
        ref={svg}
        data-testid="room-shape-canvas"
        viewBox={view.join(' ')}
        className="room-shape-canvas"
        role="img"
        aria-label={t('floorplan')}
        onPointerMove={(e) => {
          if (!drag.current) return
          const p = point(e),
            d = drag.current
          const snap = (n) => Math.round(n * 100) / 100
          change(d.id, {
            xM: Math.max(-30, Math.min(60, snap(d.x + p.x - d.p.x))),
            yM: Math.max(-30, Math.min(60, snap(d.y + p.y - d.p.y))),
          })
        }}
        onPointerUp={() => {
          drag.current = null
          setFrozenView(null)
        }}
        onPointerCancel={() => {
          drag.current = null
          setFrozenView(null)
        }}
      >
        <RoomFootprintDrawing room={room} />
        <text x="0" y={b.y - 130} fontSize="100" fill="#334155">
          {room.widthM} × {room.depthM} m · {shape.areaM2.toFixed(2)} m²
        </text>
        {features.map((f) => (
          <g
            key={f.id}
            data-testid={`room-feature-${f.id}`}
            data-room-feature={f.kind}
            tabIndex="0"
            role="button"
            aria-label={`${f.name}: ${f.widthM} × ${f.depthM} m`}
            onKeyDown={(e) => {
              if (['Enter', ' '].includes(e.key)) {
                e.preventDefault()
                setSelected(f.id)
              }
              if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                e.preventDefault()
                setSelected(f.id)
                change(f.id, {
                  xM: f.xM + (e.key === 'ArrowLeft' ? -0.01 : e.key === 'ArrowRight' ? 0.01 : 0),
                  yM: f.yM + (e.key === 'ArrowUp' ? -0.01 : e.key === 'ArrowDown' ? 0.01 : 0),
                })
              }
            }}
            onPointerDown={(e) => {
              e.preventDefault()
              setSelected(f.id)
              setFrozenView(view)
              drag.current = { id: f.id, x: f.xM, y: f.yM, p: point(e) }
              svg.current.setPointerCapture(e.pointerId)
            }}
          >
            <rect
              x={f.xM * 1000}
              y={f.yM * 1000}
              width={f.widthM * 1000}
              height={f.depthM * 1000}
              fill="transparent"
              stroke={selected === f.id ? '#7c3aed' : '#475569'}
              strokeWidth="15"
              strokeDasharray={selected === f.id ? '35 15' : 'none'}
              style={{ cursor: 'move' }}
            />
            <text x={(f.xM + 0.02) * 1000} y={(f.yM + 0.12) * 1000} fontSize="70" fill="#334155" pointerEvents="none">
              {f.widthM} × {f.depthM} m
            </text>
          </g>
        ))}
      </svg>
      <label>
        {t('element')}
        <select data-testid="room-feature-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">—</option>
          {features.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      {active && (
        <div data-testid="room-feature-fields" className="grid grid-cols-2 gap-2">
          <label>
            {t('name')}
            <input
              data-testid="room-feature-name"
              value={active.name}
              maxLength="100"
              onChange={(e) => change(active.id, { name: e.target.value })}
            />
          </label>
          {['widthM', 'depthM', 'xM', 'yM'].map((key) => (
            <label key={key}>
              {t(key)}
              <input
                data-testid={`room-feature-${key}`}
                type="number"
                min={key === 'widthM' || key === 'depthM' ? 0.05 : -30}
                max={key === 'widthM' || key === 'depthM' ? 30 : 60}
                step="0.01"
                value={active[key]}
                onChange={(e) => change(active.id, { [key]: Number(e.target.value) })}
              />
            </label>
          ))}
          <Button
            type="button"
            data-testid="room-remove-feature"
            variant="outline"
            onClick={() => {
              patch({ features: features.filter((f) => f.id !== active.id) })
              setSelected('')
            }}
          >
            {t('remove')}
          </Button>
        </div>
      )}
      {invalid && (
        <p data-testid="room-shape-invalid" role="alert">
          {t('invalid')}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <Button type="button" data-testid="room-continue" disabled={invalid} onClick={proceed}>
        {t('continue')}
      </Button>
    </section>
  )
}
