import { resetHeightLabelOffsets } from './manualHeightLabels.js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@core/components/ui/button'
import { setRailElevation, gradientSpan, applyRailGradient } from './trackElevationModel.js'
export default function RailElevationEditor({ plan, index, model, onChange, open, onOpen }) {
  const { t } = useTranslation('planner3D')
  const [target, setTarget] = useState(index + 1 < plan.pieces.length ? index + 1 : 0),
    [draft, setDraft] = useState(null),
    [error, setError] = useState('')
  const piece = plan.pieces[index],
    m = model.metrics[index]
  const elevation = piece.elevation ?? { heightMm: Math.max(0, m.startMm), flat: Math.abs(m.endMm - m.startMm) < 1e-6 }
  let span = null
  try {
    span = gradientSpan(model, index, target)
  } catch {}
  const crossing = model.crossingMeasures
    .filter((c) => c.upperRail === index)
    .sort((a, b) => a.clearanceMm - b.clearanceMm)[0]
  const set = (next) => {
    onChange(setRailElevation(plan, index, next))
    setError('')
  }
  return (
    <details data-testid="two-height-editor" open={open} onToggle={(e) => onOpen(e.currentTarget.open)}>
      <summary>{t('heightEdit2D')}</summary>
      <fieldset>
        <legend>
          {t('rail')} {index + 1}
        </legend>
        {piece.heightLabelOffset && (
          <Button
            type="button"
            variant="outline"
            data-testid="reset-selected-height-label"
            onClick={() => onChange(resetHeightLabelOffsets(plan, index))}
          >
            {t('arrangeSelectedLabel')}
          </Button>
        )}
        <p data-testid="two-height-metrics">
          {t('heightRange', { start: m.startMm.toFixed(1), end: m.endMm.toFixed(1) })} · {t('meanSlope')}:{' '}
          {m.meanPercent.toFixed(1)} % · {t('maxSlope')}: {m.peakPercent.toFixed(1)} %
        </p>
        <label>
          {t('railHeight')}
          <input
            data-testid="two-rail-height"
            type="number"
            min="0"
            max="3000"
            step="any"
            value={elevation.heightMm}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n)) set({ ...elevation, heightMm: Math.max(0, Math.min(3000, n)) })
            }}
          />
        </label>
        {crossing && (
          <label>
            {t('localClearance')}
            <input
              data-testid="two-local-clearance"
              type="number"
              min="0"
              max="3000"
              step="any"
              value={Math.round(crossing.clearanceMm * 100) / 100}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (Number.isFinite(v))
                  set({
                    heightMm: Math.max(
                      0,
                      Math.min(3000, crossing.lowerBaseHeight - model.baseHeight + 10 + Math.max(0, v)),
                    ),
                    flat: true,
                  })
              }}
            />
          </label>
        )}
        <label>
          <input
            data-testid="two-rail-flat"
            type="checkbox"
            checked={elevation.flat}
            disabled={['Control_unit', 'AdapterUnit'].includes(piece.type)}
            onChange={(e) => set({ ...elevation, flat: e.target.checked })}
          />
          {t('railFlat')}
        </label>
        <div>
          <Button type="button" data-testid="two-set-height" onClick={() => set(elevation)}>
            {t('setHeight')}
          </Button>
          <Button
            type="button"
            data-testid="two-remove-height"
            variant="outline"
            disabled={!piece.elevation}
            onClick={() => set(null)}
          >
            {t('removeHeight')}
          </Button>
        </div>
        <label>
          {t('slopeTarget')}
          <select
            data-testid="two-slope-target"
            value={target}
            onChange={(e) => {
              setTarget(Number(e.target.value))
              setDraft(null)
              setError('')
            }}
          >
            {plan.pieces.map((p, i) =>
              i === index ? null : (
                <option key={i} value={i}>
                  {i + 1} · {p.type}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          {t('slopeInput')}
          <input
            data-testid="two-slope-percent"
            type="number"
            step="any"
            value={draft ?? (span ? span.meanPercent.toFixed(2) : '')}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        {span && (
          <p data-testid="two-slope-distance">{t('horizontalDistance', { distance: span.distanceMm.toFixed(1) })}</p>
        )}
        {!span && <p>{t('slopeDisconnected')}</p>}
        <Button
          type="button"
          data-testid="two-apply-slope"
          disabled={!span}
          onClick={() => {
            try {
              if (draft === '') throw new Error('slope')
              const next = applyRailGradient(plan, model, index, target, Number(draft ?? span.meanPercent))
              onChange(next)
              setDraft(null)
              setError('')
            } catch (e) {
              setError(
                t(e.message === 'height' ? 'slopeHeightError' : e.message === 'unit' ? 'slopeUnitError' : 'slopeError'),
              )
            }
          }}
        >
          {t('applySlope')}
        </Button>
        <p>{t('slopeEditHelp')}</p>
        {error && (
          <p role="alert" data-testid="two-height-error">
            {error}
          </p>
        )}
      </fieldset>
    </details>
  )
}
