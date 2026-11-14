import { suggestRampLengths } from './rampSuggestions.js'
import { DEFAULT_RAMPS } from './rampProfiles.js'
import { DEFAULT_SCENE_HEIGHTS } from '../../../../vendor/racehubos/shared/src/trackPlan.js'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@core/components/ui/button'
import TrackImageExport from './PlannerImageExport'
import { UnitDetails, FuelDetail, SwitchDiodeDetails } from '@core/components/tracks/TrackUnitDetails'
import { PitSwitchDetail } from '@core/components/tracks/PitSwitchDetail'
import { trackViewport } from './trackViewport'
import { buildRoomScene, projectRoomScene } from './roomScene3d.js'
const initial = { yaw: -35, pitch: 55, zoom: 1, pan: { x: 0, y: 0 } }
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
const path = (points) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
function shade(color, item) {
  if (!item.side) return color
  const p = item.points,
    a = p[0],
    b = p[1],
    d = Math.hypot(b.x - a.x, b.y - a.y) || 1,
    factor = 0.65 + 0.2 * Math.abs((b.x - a.x) / d)
  return (
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round(parseInt(color.slice(i, i + 2), 16) * factor)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}
export default function RoomTrack3D({ plan, name, onEditor, onRoom, onChange, initialSelected = 0 }) {
  const { t } = useTranslation('planner3D'),
    id = 'scene-' + useId().replaceAll(':', ''),
    svgRef = useRef(null),
    drag = useRef(null)
  const [targetSlope, setTargetSlope] = useState(15)
  const [heightRail, setHeightRail] = useState(Math.max(0, initialSelected))
  const [camera, setCamera] = useState(initial),
    [settings, setSettings] = useState({ walls: true, cutaway: true, obstacles: true, labels: true, dimensions: true }),
    [viewport, setViewport] = useState({ width: 1000, height: 700 })
  const height = plan.sceneHeights ?? DEFAULT_SCENE_HEIGHTS
  const rampSettings = plan.sceneRamps ?? DEFAULT_RAMPS
  const selectedPiece = plan.pieces[heightRail]
  const elevation = selectedPiece?.elevation ?? {
    heightMm: (selectedPiece?.level ?? 0) * (height.clearance + 10),
    flat: true,
  }
  function setElevation(next) {
    onChange({
      ...plan,
      pieces: plan.pieces.map((p, i) => {
        if (i !== heightRail) return p
        const copy = { ...p }
        if (next) copy.elevation = ['Control_unit', 'AdapterUnit'].includes(p.type) ? { ...next, flat: true } : next
        else delete copy.elevation
        return copy
      }),
    })
  }

  const scene = useMemo(() => buildRoomScene(plan, height), [plan, height]),
    projected = useMemo(() => projectRoomScene(scene, camera, settings), [scene, camera.yaw, camera.pitch, settings])
  const suggestion = useMemo(() => suggestRampLengths(plan, targetSlope), [plan, targetSlope])
  const selectedCrossing = scene.crossingMeasures.find((c) => c.upperRail === heightRail)
  const box = trackViewport(projected.bounds, viewport, camera.zoom, camera.pan)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const update = () => {
      const b = svg.getBoundingClientRect()
      setViewport({ width: b.width, height: b.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(svg)
    const wheel = (e) => {
      e.preventDefault()
      setCamera((c) => ({ ...c, zoom: clamp(c.zoom * Math.exp(-e.deltaY * 0.0015), 0.3, 8) }))
    }
    svg.addEventListener('wheel', wheel, { passive: false })
    return () => {
      ro.disconnect()
      svg.removeEventListener('wheel', wheel)
    }
  }, [])
  function reset() {
    setCamera({ ...initial, pan: { x: 0, y: 0 } })
  }
  function art(item) {
    const housing = item.kind === 'unit-top',
      clip = `${id}-${item.id}`
    return (
      <g key={item.id} transform={item.matrix} pointerEvents="none" data-3d-art={item.kind}>
        {item.kind === 'fuel' ? (
          <FuelDetail index={`3d-${item.index}`} pose={{ xMm: 0, yMm: 0, headingDegrees: 0 }} article="30361" />
        ) : item.kind === 'pit-switch' ? (
          <PitSwitchDetail entry native pose={{ xMm: 0, yMm: 0, headingDegrees: 0 }} />
        ) : (
          <>
            <defs>
              <clipPath id={clip}>
                <rect x="0" y={housing ? -238 : -99} width="345" height={housing ? 139 : 198} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clip})`}>
              <UnitDetails segment={{ index: item.index, type: item.type, start: { x: 0, y: 0, h: 0 } }} />
              {item.type === 'Pit_stop_weiche_anfang' && (
                <PitSwitchDetail entry pose={{ xMm: 0, yMm: 0, headingDegrees: 0 }} />
              )}
              <SwitchDiodeDetails segment={{ index: item.index, type: item.type, start: { x: 0, y: 0, h: 0 } }} />
            </g>
          </>
        )}
      </g>
    )
  }
  return (
    <section data-testid="room-track-3d" className="planner-3d-pane">
      <div className="planner-3d-controls" role="toolbar" aria-label={t('controls')}>
        <Button type="button" data-testid="three-back-editor" variant="outline" onClick={onEditor}>
          {t('editor')}
        </Button>
        <Button type="button" variant="outline" onClick={onRoom}>
          {t('room')}
        </Button>
        <Button type="button" data-testid="three-reset" variant="outline" onClick={reset}>
          {t('reset')}
        </Button>
        <Button
          type="button"
          data-testid="three-top"
          variant="outline"
          onClick={() => setCamera((c) => ({ ...c, yaw: 0, pitch: 90, zoom: 1, pan: { x: 0, y: 0 } }))}
        >
          {t('top')}
        </Button>
        <Button
          type="button"
          data-testid="three-fit"
          variant="outline"
          onClick={() => setCamera((c) => ({ ...c, zoom: 1, pan: { x: 0, y: 0 } }))}
        >
          {t('fit')}
        </Button>
        <Button type="button" data-testid="three-center" variant="outline"
          onClick={() => setCamera((c) => ({ ...c, pan: { x: 0, y: 0 } }))}>
          {t('center')}
        </Button>
        {[
          ['yaw', -180, 180],
          ['pitch', 15, 90],
          ['zoom', 0.3, 8],
        ].map(([key, min, max]) => (
          <label key={key}>
            {t(key)}
            <input
              data-testid={`three-${key}`}
              type="range"
              min={min}
              max={max}
              step="any"
              value={camera[key]}
              onChange={(e) => setCamera((c) => ({ ...c, [key]: Number(e.target.value) }))}
            />
          </label>
        ))}
        <details data-testid="three-display-settings">
          <summary>{t('display')}</summary>
          <div className="planner-3d-settings">
            {['walls', 'cutaway', 'obstacles', 'labels', 'dimensions'].map((key) => (
              <label key={key}>
                <input
                  data-testid={`three-${key}`}
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
                />
                {t(key)}
              </label>
            ))}
            {[
              ['wallHeight', 500, 4000],
              ['obstacleHeight', 50, 4000],
              ['baseHeight', 0, 1500],
              ['clearance', 50, 500],
            ].map(([key, min, max]) => (
              <label key={key}>
                {t(key)}
                <input
                  data-testid={`three-${key}`}
                  type="number"
                  min={min}
                  max={max}
                  step="any"
                  value={height[key]}
                  onChange={(e) => {
                    const value = clamp(Number(e.target.value), min, max)
                    if (Number.isFinite(value)) onChange({ ...plan, sceneHeights: { ...height, [key]: value } })
                  }}
                />
              </label>
            ))}
            {['ascentLengthMm', 'descentLengthMm'].map((key) => (
              <label key={key}>
                {t(key)}
                <input
                  data-testid={`three-${key}`}
                  type="number"
                  min="100"
                  max="20000"
                  step="any"
                  value={rampSettings[key]}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (Number.isFinite(v))
                      onChange({ ...plan, sceneRamps: { ...rampSettings, [key]: clamp(v, 100, 20000) } })
                  }}
                />
              </label>
            ))}
            <fieldset>
              <legend>{t('heightProfile')}</legend>
              <label>
                {t('rail')}
                <select
                  data-testid="three-height-rail"
                  value={heightRail}
                  onChange={(e) => setHeightRail(Number(e.target.value))}
                >
                  {plan.pieces.map((p, i) => (
                    <option key={i} value={i}>
                      {i + 1} · {p.type}
                    </option>
                  ))}
                </select>
              </label>
              {!!selectedPiece && (
                <>
                  <label>
                    {t('railHeight')}
                    <input
                      data-testid="three-rail-height"
                      type="number"
                      min="0"
                      max="3000"
                      step="any"
                      value={elevation.heightMm}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (Number.isFinite(n)) setElevation({ ...elevation, heightMm: clamp(n, 0, 3000) })
                      }}
                    />
                  </label>
                  <label>
                    <input
                      data-testid="three-rail-flat"
                      type="checkbox"
                      checked={elevation.flat}
                      onChange={(e) => setElevation({ ...elevation, flat: e.target.checked })}
                    />
                    {t('railFlat')}
                  </label>
                  {selectedCrossing && (
                    <label>
                      {t('localClearance')}
                      <input
                        data-testid="three-local-clearance"
                        type="number"
                        min="0"
                        max="3000"
                        step="any"
                        value={Math.round(selectedCrossing.clearanceMm * 100) / 100}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          if (Number.isFinite(v))
                            setElevation({
                              heightMm: clamp(selectedCrossing.lowerBaseHeight - scene.baseHeight + 10 + v, 0, 3000),
                              flat: true,
                            })
                        }}
                      />
                    </label>
                  )}
                  <Button type="button" data-testid="three-set-height" onClick={() => setElevation(elevation)}>
                    {t('setHeight')}
                  </Button>
                  <Button
                    type="button"
                    data-testid="three-remove-height"
                    disabled={!selectedPiece.elevation}
                    onClick={() => setElevation(null)}
                  >
                    {t('removeHeight')}
                  </Button>
                </>
              )}
              <p>{t('profileHelp')}</p>
              {plan.pieces.flatMap((p, i) =>
                p.elevation
                  ? [
                      <button type="button" key={i} data-testid="three-height-point" onClick={() => setHeightRail(i)}>
                        {t('rail')} {i + 1}: {p.elevation.heightMm} mm {p.elevation.flat ? '—' : ''}
                      </button>,
                    ]
                  : [],
              )}
            </fieldset>
            {!plan.sceneRamps && (
              <Button
                type="button"
                data-testid="three-enable-ramps"
                onClick={() => onChange({ ...plan, sceneRamps: { ...DEFAULT_RAMPS } })}
              >
                {t('applyRamps')}
              </Button>
            )}
          </div>
        </details>
      </div>
      <p className="text-xs">
        {t('interaction')} · {t('levels', { height: scene.clearance, spacing: scene.levelHeight })}
      </p>
      {!!scene.ramps.length && (
        <details data-testid="three-ramp-suggestions">
          <summary>{t('suggestions')}</summary>
          <label>
            {t('targetSlope')}
            <input data-testid="three-target-slope" type="number" min="1" max="100" step="1"
              value={targetSlope} onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) setTargetSlope(clamp(n, 1, 100))
              }} />
          </label>
          <p>{t(suggestion.custom ? 'customSuggestionHelp' : 'suggestHelp')}</p>
          <table className="planner-ramp-table">
            <thead><tr>
              <th>{t('ramp')}</th><th>{t('actualLength')}</th><th>{t('currentMax')}</th>
              <th>{t('suggestedMax')}</th><th>{t('affectedRails')}</th><th>{t('applySuggestion')}</th>
            </tr></thead>
            <tbody>{suggestion.directions.map((r) => (
              <tr key={r.key} data-testid={`three-suggestion-${r.up ? 'ascent' : 'descent'}`}>
                <td>{t(r.up ? 'ascent' : 'descent')}</td>
                <td>{Math.round(r.lengthMm)} mm</td>
                <td>{r.currentMaxPercent.toFixed(1)} %</td>
                <td>{r.maxPercent.toFixed(1)} % {r.limited && <span>{t('limited')}</span>}</td>
                <td>{r.rails.join(', ')}</td>
                <td><Button type="button" disabled={suggestion.custom}
                  data-testid={`three-apply-${r.up ? 'ascent' : 'descent'}`}
                  onClick={() => onChange({ ...plan, sceneRamps: { ...rampSettings, [r.key]: suggestion.settings[r.key] } })}>
                  {t('applySuggestion')}
                </Button></td>
              </tr>
            ))}</tbody>
          </table>
          <Button type="button" data-testid="three-suggest-ramps" disabled={suggestion.custom}
            onClick={() => onChange({ ...plan, sceneRamps: suggestion.settings })}>{t('suggestRamps')}</Button>
        </details>
      )}
      {!!scene.ramps.length && (
        <details data-testid="three-ramp-gradients">
          <summary>{t('gradients')}</summary>
          <div style={{ maxHeight: 150, overflow: 'auto' }}>
            <table className="planner-ramp-table">
              <thead>
                <tr>
                  <th>{t('ramp')}</th>
                  <th>{t('actualLength')}</th>
                  <th>{t('rise')}</th>
                  <th>{t('meanSlope')}</th>
                  <th>{t('maxSlope')}</th>
                </tr>
              </thead>
              <tbody>
                {scene.ramps.map((r) => (
                  <tr key={r.index} data-testid="three-ramp-row">
                    <td>
                      {t(r.up ? 'ascent' : 'descent')} {r.index + 1}
                    </td>
                    <td>
                      {Math.round(r.lengthMm)} mm {r.clipped && <span title={t('limited')}>⚠ {t('limited')}</span>}
                    </td>
                    <td>{Math.round(r.riseMm)} mm</td>
                    <td>{r.meanPercent === null ? '—' : (r.up ? '' : '−') + r.meanPercent.toFixed(1) + ' %'}</td>
                    <td>{r.maxPercent === null ? '—' : (r.up ? '' : '−') + r.maxPercent.toFixed(1) + ' %'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>{t('slopeNote')}</p>
          </div>
        </details>
      )}
      {!scene.hasRoom && (
        <p role="status" data-testid="three-no-room">
          {t('noRoom')}
        </p>
      )}
      <TrackImageExport className="planner-3d-export" name={`${name || 'Carrera'}-3D`}>
        <svg
          ref={svgRef}
          data-testid="room-3d-canvas"
          data-rail-count={scene.railCount}
          data-yaw={camera.yaw}
          data-pitch={camera.pitch}
          viewBox={box.join(' ')}
          className="planner-3d-canvas"
          tabIndex="0"
          role="img"
          aria-label={t('title')}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            if (![0, 1, 2].includes(e.button)) return
            e.preventDefault()
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              camera,
              pan: e.shiftKey || e.button !== 0,
              box,
              rail: e.target.getAttribute('data-3d-rail'),
            }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d) return
            const dx = e.clientX - d.x,
              dy = e.clientY - d.y
            if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true
            if (d.pan)
              setCamera({
                ...d.camera,
                pan: {
                  x: d.camera.pan.x - (dx * d.box[2]) / viewport.width,
                  y: d.camera.pan.y - (dy * d.box[3]) / viewport.height,
                },
              })
            else
              setCamera({
                ...d.camera,
                yaw: ((d.camera.yaw + dx * 0.4 + 540) % 360) - 180,
                pitch: clamp(d.camera.pitch - dy * 0.3, 15, 90),
              })
          }}
          onPointerUp={(e) => {
            if (drag.current && !drag.current.moved) {
              const rail = drag.current.rail
              if (rail !== null && rail !== '') setHeightRail(Number(rail))
            }
            drag.current = null
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
          onKeyDown={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '0'].includes(e.key)) {
              e.preventDefault()
              if (e.key === '0') reset()
              else
                setCamera((c) => ({
                  ...c,
                  yaw: c.yaw + (e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0),
                  pitch: clamp(c.pitch + (e.key === 'ArrowUp' ? 5 : e.key === 'ArrowDown' ? -5 : 0), 15, 90),
                  zoom: clamp(c.zoom * (e.key === '+' ? 1.2 : e.key === '-' ? 1 / 1.2 : 1), 0.3, 8),
                }))
            }
          }}
        >
          <title>{t('title')}</title>
          <desc>{t('note')}</desc>
          {projected.items.map((item, i) =>
            item.render === 'face' ? (
              <path
                key={item.id}
                data-3d-kind={item.kind}
                data-3d-rail={item.rail}
                data-height-selected={item.rail === heightRail ? 'true' : undefined}
                d={path(item.points) + 'Z'}
                fill={shade(item.color, item)}
                fillOpacity={item.kind === 'wall' ? 0.55 : 1}
                stroke={
                  item.mesh ? 'none' : item.kind === 'wall' ? '#9aaabd' : item.kind === 'floor' ? '#d2cabe' : '#1e293b'
                }
                strokeWidth={item.kind === 'wall' ? 5 : item.kind === 'floor' ? 2 : 1}
              />
            ) : item.render === 'line' ? (
              <path
                key={item.id}
                data-3d-kind={item.kind}
                d={path(item.points)}
                fill="none"
                stroke={item.color}
                strokeWidth={item.width}
                strokeDasharray={item.dash}
                pointerEvents="none"
              />
            ) : item.render === 'art' ? (
              art(item)
            ) : (
              <text
                key={`label-${i}`}
                x={item.point.x}
                y={item.point.y}
                fill="#334155"
                fontSize="90"
                fontWeight="600"
                textAnchor="middle"
                paintOrder="stroke"
                stroke="#fff"
                strokeWidth="12"
              >
                {item.text}
              </text>
            ),
          )}
        </svg>
      </TrackImageExport>
      <p className="text-xs" data-testid="three-model-note">
        {t('note')}
      </p>
    </section>
  )
}
