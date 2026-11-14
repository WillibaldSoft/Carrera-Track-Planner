import PrintTrackDrawing from './PrintTrackDrawing'
import RoomTrack3D from './RoomTrack3D'
import { snapshotDrawing } from './drawingSnapshot.js'
import { downloadSnapshotPdf } from './PlannerImageExport'
import { pitlaneLegend } from '@core/components/tracks/pitlaneComponents'
import { BorderPartsList } from './TrackBorders'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  traceTrackPlan,
  railRequirements,
  pitTurnoutHasNativeExtra,
  CARRERA_RAILS,
  TRACK_PARTS,
} from '@racehubos/shared'
import { trackPartAppearance } from '@core/components/tracks/trackPartAppearance'
import { labelTrackPart } from '@core/components/tracks/trackPartLabel'
import { Button } from '@core/components/ui/button'
export function TrackTypeLegend({ plan, visibleLevel = null }) {
  const segments = traceTrackPlan(plan).segments
  const pitParts =
    visibleLevel === null || segments[plan.pit.entry]?.level === visibleLevel ? pitlaneLegend(plan, segments) : []
  const { t } = useTranslation('tracks')
  const counts = plan.pieces
    .filter(
      (p, index) =>
        (visibleLevel === null || p.level === visibleLevel) &&
        !(
          p.type.startsWith('Pit_stop_weiche_') &&
          ((plan.pit.enabled && !plan.pit.native && [plan.pit.entry, plan.pit.merge].includes(index)) ||
            pitTurnoutHasNativeExtra(plan, segments, index))
        ),
    )
    .reduce((map, p) => ((map[p.type] = (map[p.type] || 0) + 1), map), {})
  return (
    <ul data-testid="track-type-legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {Object.entries(counts).map(([type, n]) => (
        <li key={type} className="flex items-center gap-1">
          <span
            style={{
              background: trackPartAppearance(type).color,
              display: 'inline-block',
              width: 12,
              height: 12,
              border: '1px solid #333',
            }}
          />
          {labelTrackPart(type)} × {n}
        </li>
      ))}
      {pitParts.map((p) => (
        <li key={p.kind} data-testid={`pit-legend-${p.kind}`} className="flex items-center gap-1">
          <span
            style={{
              background: p.color,
              display: 'inline-block',
              width: 12,
              height: 12,
              border: '1px solid #333',
            }}
          />
          {p.short} · {t(`pitParts.${p.kind}`)} · {p.article} × {p.count}
        </li>
      ))}
    </ul>
  )
}
export default function TrackPlanPrint({ plan, name, drawingRef, inline = false }) {
  const { t } = useTranslation('tracks')
  const { t: ui } = useTranslation('plannerInterface')
  const renderPanel = inline ? (content) => content : createPortal
  const { t: t3 } = useTranslation('planner3D')
  const [snapshot, setSnapshot] = useState(null),
    [busy, setBusy] = useState(false),
    [snapshotError, setSnapshotError] = useState(false)
  async function openPrint() {
    setBusy(true)
    setSnapshotError(false)
    try {
      setSnapshot(await snapshotDrawing(drawingRef.current))
      setView('current')
      setOpen(true)
    } catch {
      setSnapshotError(true)
    } finally {
      setBusy(false)
    }
  }
  const [open, setOpen] = useState(inline),
    [view, setView] = useState(inline ? 'overview' : 'current'),
    [format, setFormat] = useState('A4'),
    [orientation, setOrientation] = useState('landscape'),
    [rotation, setRotation] = useState('0')
  const [projection, setProjection] = useState('plan2d')
  const [contents, setContents] = useState({
    drawing: true,
    includeRoom: false,
    highlight: false,
    numbers: false,
    materialList: true,
    legend: false,
    borderList: false,
  })
  const toggle = (key, value) => setContents((c) => ({ ...c, [key]: value }))
  const requirements = railRequirements(plan)
  const materialRows = CARRERA_RAILS.filter((p) => requirements.counts[p.article] > 0)
  const hasContents = contents.drawing || contents.materialList || contents.legend || contents.borderList
  const levels = [...new Set(plan.pieces.map((p) => p.level))].sort(),
    data = traceTrackPlan(plan)
  const pages = view === 'levels' && (!inline || projection === 'plan2d') ? levels : [null]
  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-testid="track-print-preview"
        hidden={inline}
        disabled={!plan.pieces.length || busy}
        onClick={openPrint}
      >
        {t('print.open')}
      </Button>
      {snapshotError && <p role="alert">{t3('snapshotError')}</p>}
      {open &&
        renderPanel(
          <div
            className={
              inline
                ? 'planner-inline-panel track-print-inline bg-white text-black p-5'
                : 'track-print-portal fixed inset-0 z-[100] bg-white text-black overflow-auto p-5'
            }
            role={inline ? 'region' : 'dialog'}
            onKeyDown={(e) => {
              if (!inline && e.key === 'Escape') {
                e.stopPropagation()
                setOpen(false)
              }
            }}
            aria-modal={inline ? undefined : true}
            aria-label={t('print.open')}
            data-testid="track-print-dialog"
          >
            <style>{`@media print { @page {size:${format} ${orientation};margin:10mm} ${inline ? '' : 'body > *:not(.track-print-portal){display:none!important}'} .track-print-portal{position:static!important;overflow:visible!important;padding:0!important;color:#000!important;background:#fff!important;display:block!important} .track-print-portal .print-tools{display:none!important} .track-print-page{break-after:page} .track-print-page:last-child{break-after:auto} .track-print-portal svg{width:100%!important;height:auto!important;max-height:${orientation === 'landscape' ? '145' : '215'}mm!important} .track-print-portal *{print-color-adjust:exact;-webkit-print-color-adjust:exact} }`}</style>
            {inline && <h2 className="print-tools text-xl font-bold mb-4">{ui('print')}</h2>}
            <div className="print-tools flex flex-wrap gap-3 mb-4 items-center">
              <label hidden={inline && projection !== 'plan2d'}>
                {t('print.view')}{' '}
                <select
                  data-testid="track-print-view"
                  value={view}
                  onChange={(e) => {
                    const v = e.target.value
                    setView(v)
                    if (inline)
                      setContents((c) => ({
                        ...c,
                        highlight: v !== 'overview',
                        numbers: v === 'assembly',
                        legend: v === 'colors',
                      }))
                  }}
                >
                  {(inline
                    ? ['overview', 'colors', 'assembly', 'levels']
                    : ['current', 'overview', 'colors', 'assembly', 'levels']
                  ).map((k) => (
                    <option key={k} value={k}>
                      {k === 'current' ? t3('currentDrawing') : t(`print.${k}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('print.paper')}{' '}
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  {['A4', 'A3'].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('print.orientation')}{' '}
                <select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
                  {['landscape', 'portrait'].map((k) => (
                    <option key={k} value={k}>
                      {k === 'current' ? t3('currentDrawing') : t(`print.${k}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('graph.rotation')}{' '}
                <select
                  data-testid="track-print-rotation"
                  disabled={view === 'current' || (inline && projection !== 'plan2d')}
                  value={rotation}
                  onChange={(e) => setRotation(e.target.value)}
                >
                  {['0', '90', '180', '270'].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>{' '}
                °
              </label>
              {view === 'current' && (
                <Button
                  type="button"
                  data-testid="track-print-pdf"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await downloadSnapshotPdf(snapshot, name, { paper: format, orientation })
                    } catch {
                      setSnapshotError(true)
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  {t3('exportPdf')}
                </Button>
              )}
              <Button
                type="button"
                data-testid="track-print-now"
                disabled={inline && !hasContents}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await Promise.all(
                      [...document.querySelectorAll('.track-print-portal img')].map((img) => img.decode()),
                    )
                    window.print()
                  } catch {
                    setSnapshotError(true)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {t('print.print')}
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid="track-print-close"
                hidden={inline}
                onClick={() => setOpen(false)}
              >
                {t('print.close')}
              </Button>
              <p className="text-sm">{view === 'current' ? t3('snapshotPrintNote') : t('print.note')}</p>
              {snapshotError && <p role="alert">{t3('snapshotError')}</p>}
            </div>
            {inline && (
              <fieldset className="print-tools planner-print-options">
                <legend>{ui('contents')}</legend>
                <p>{ui('choosePrint')}</p>
                <label>
                  {ui('projection')}{' '}
                  <select
                    data-testid="print-projection"
                    value={projection}
                    onChange={(e) => setProjection(e.target.value)}
                  >
                    {['plan2d', 'perspective', 'cu', 'top', 'side', 'front'].map((k) => (
                      <option
                        key={k}
                        value={k}
                        disabled={k === 'cu' && !plan.pieces.some((p) => p.type === 'Control_unit')}
                      >
                        {ui(k)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="planner-print-choices">
                  {Object.keys(contents).map((key) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        data-testid={`print-include-${key}`}
                        checked={contents[key]}
                        disabled={
                          (key === 'includeRoom' && !plan.roomPlan) ||
                          (['highlight', 'numbers'].includes(key) && projection !== 'plan2d')
                        }
                        onChange={(e) => toggle(key, e.target.checked)}
                      />
                      {ui(key)}
                    </label>
                  ))}
                </div>
                {!plan.roomPlan && <p>{ui('noRoom')}</p>}
                {projection !== 'plan2d' && <p>{ui('color2d')}</p>}
                {!hasContents && <p role="status">{ui('noContents')}</p>}
              </fieldset>
            )}
            {pages.map((level) => (
              <section key={level ?? 'all'} className="track-print-page space-y-3" data-testid="track-print-page">
                <h1 className="text-xl font-bold">
                  {name} ·{' '}
                  {inline && projection !== 'plan2d'
                    ? ui(projection)
                    : view === 'current'
                      ? t3('currentDrawing')
                      : t(`print.${view}`)}
                  {level !== null ? ` · ${t('editor.level')} ${level}` : ''}
                </h1>
                <p>
                  {t(plan.freePlacement && !data.connectivity.closed ? 'free.material' : 'editor.lanes')}:{' '}
                  {data.laneLengthsM.map((n) => n.toFixed(3)).join(' / ')} m · {t('editor.gap')}:{' '}
                  {plan.freePlacement && !data.connectivity.closed ? '—' : data.gapMm.toFixed(2)} mm ·{' '}
                  {plan.pieces.length} {t('room.parts')}
                </p>
                {(!inline || contents.drawing) &&
                  (view === 'current' ? (
                    <div
                      className="track-print-snapshot"
                      style={{ height: orientation === 'landscape' ? '145mm' : '215mm', width: '100%' }}
                    >
                      <img
                        data-testid="track-print-snapshot"
                        src={snapshot.url}
                        alt={t3('currentDrawing')}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  ) : inline && projection !== 'plan2d' ? (
                    <RoomTrack3D
                      key={`${projection}-${contents.includeRoom}`}
                      plan={contents.includeRoom ? plan : { ...plan, roomPlan: undefined }}
                      name={name}
                      printMode
                      cameraPreset={projection}
                    />
                  ) : (
                    <PrintTrackDrawing
                      plan={plan}
                      room={inline && contents.includeRoom}
                      colors={inline ? contents.highlight : view !== 'overview'}
                      numbers={inline ? contents.numbers : view === 'assembly'}
                      level={level}
                      rotation={Number(rotation)}
                    />
                  ))}
                {(!inline || contents.legend) && <TrackTypeLegend plan={plan} visibleLevel={level} />}
                {(!inline || contents.borderList) && <BorderPartsList plan={plan} visibleLevel={level} />}
                {inline && contents.materialList && level === pages.at(-1) && (
                  <section data-testid="print-material-list">
                    <h2 className="font-bold">{ui('materialList')}</h2>
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th>{t('inventory.article')}</th>
                          <th>{t('inventory.part')}</th>
                          <th>{t('inventory.required')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialRows.map((p) => (
                          <tr key={p.article} data-testid={`print-material-${p.article}`}>
                            <td>{p.article}</td>
                            <td>
                              {t(`inventory.parts.${p.label}`, { defaultValue: p.name || p.label })}
                              {p.article === '30356' && (
                                <span className="block text-xs">
                                  {ui('pitPairComposition', { count: requirements.counts[p.article] })}
                                </span>
                              )}
                            </td>
                            <td>{requirements.counts[p.article]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!!requirements.unresolved.length && (
                      <p role="alert">
                        {t('inventory.unresolved')}: {requirements.unresolved.join(', ')}
                      </p>
                    )}
                  </section>
                )}
                {!inline && view === 'assembly' && (
                  <ol className="text-xs grid grid-cols-3 gap-x-4">
                    {plan.pieces.map((p, i) => (
                      <li key={i}>
                        {i + 1}. {labelTrackPart(p.type)} · {t('editor.level')} {p.level}
                      </li>
                    ))}
                  </ol>
                )}
                {plan.pieces.some((p) => TRACK_PARTS[p.type].approximateSlots) && (
                  <p className="text-xs">{t('catalogue.approximateSlots')}</p>
                )}
                <p className="text-xs">
                  {t('print.note')}
                  {plan.pit.enabled ? ` · ${t('editor.doublePit')}` : ''}
                </p>
              </section>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
