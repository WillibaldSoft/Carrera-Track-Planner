import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@core/components/ui/button'
import { TrackPlanPreview } from '@core/components/tracks/TrackPlanPreview'
import { openTrackPorts, railRequirements, trackFootprint } from '@racehubos/shared'
import { createPitLayout, distributePitPlaces, insertPitLayout } from './pitPlanning'
export default function PitLanePlanner({ plan, selected, onChange, onEditor }) {
  const { t } = useTranslation('plannerInterface')
  const [places, setPlaces] = useState(2),
    [counts, setCounts] = useState([2]),
    [laneChange, setLaneChange] = useState(true),
    [gap, setGap] = useState(1)
  const [variants, setVariants] = useState([]),
    [choice, setChoice] = useState(0),
    [error, setError] = useState(''),
    [applied, setApplied] = useState(false)
  const ports = openTrackPorts(plan),
    requirements = railRequirements(plan)
  const [placement, setPlacement] = useState(ports.length || !plan.pieces.length ? 'append' : 'replace'),
    [start, setStart] = useState(Math.max(0, selected)),
    [connection, setConnection] = useState(''),
    [otherSide, setOtherSide] = useState(false)
  const port = ports.find((p) => `${p.index}:${p.end}` === connection) || ports.at(-1)
  function reset() {
    setVariants([])
    setTarget('all')
    setError('')
    setApplied(false)
  }
  function suggest() {
    try {
      const options = { places, distribution: counts, laneChange, gap }
      setVariants([
        { name: 'serial', plan: createPitLayout(options) },
        ...(places > counts.length
          ? [{ name: 'parallel', plan: createPitLayout({ ...options, parallel: true }) }]
          : []),
      ])
      setChoice(0)
      setError('')
      setApplied(false)
    } catch (e) {
      setError(e.message)
    }
  }
  const [target, setTarget] = useState('all')
  const variant = variants[choice]
  const insertionTemplate = variant
    ? target === 'all'
      ? variant.plan
      : createPitLayout({
          places: counts[Number(target)],
          distribution: [counts[Number(target)]],
          parallel: variant.name === 'parallel',
          laneChange,
          gap: 0,
        })
    : null
  let insertion, insertionError
  if (variant) {
    try {
      insertion = insertPitLayout(plan, insertionTemplate, { placement, port, selected: start, otherSide })
    } catch (e) {
      insertionError = e.message
    }
  }
  function apply() {
    try {
      const next = insertPitLayout(plan, insertionTemplate, { placement, port, selected: start, otherSide })
      onChange(next)
      setApplied(true)
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <section className="planner-inline-panel planner-pit-page p-5" data-testid="pit-planner">
      <h2 className="text-xl font-bold">{t('pit')}</h2>
      <p>{t('pitHelp')}</p>
      <p className="planner-pit-existing" data-testid="pit-access-rule">
        {t('accessRule')}
      </p>
      <p className="planner-pit-existing">
        {t('existingPit')}: {requirements.counts['30361']} {t('fuelPlaces')} · {requirements.counts['30356']}{' '}
        {t('pitPairs')}
      </p>
      <fieldset className="planner-pit-settings">
        <legend>{t('configurationTitle')}</legend>
        <label>
          {t('places')}
          <input
            type="number"
            min="1"
            max="10"
            data-testid="pit-total"
            value={places}
            onChange={(e) => {
              const n = Number(e.target.value)
              setPlaces(e.target.value === '' ? '' : n)
              if (Number.isInteger(n) && n >= 1 && n <= 10)
                setCounts(distributePitPlaces(n, Math.min(counts.length, n)))
              reset()
            }}
          />
        </label>
        <label>
          {t('stops')}
          <select
            data-testid="pit-stops"
            value={counts.length}
            onChange={(e) => {
              setCounts(distributePitPlaces(Number(places), Number(e.target.value)))
              reset()
            }}
            disabled={!Number.isInteger(places) || places < 1 || places > 10}
          >
            {Array.from({ length: Number.isInteger(places) && places >= 1 && places <= 10 ? places : 1 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('gap')}
          <input
            type="number"
            min="0"
            max="6"
            data-testid="pit-gap"
            value={gap}
            onChange={(e) => {
              setGap(e.target.value === '' ? '' : Number(e.target.value))
              reset()
            }}
          />
        </label>
      </fieldset>
      <fieldset className="planner-pit-settings">
        <legend>{t('distribution')}</legend>
        {counts.map((n, i) => (
          <label key={i}>
            {t('pit')} {i + 1}
            <input
              type="number"
              min="1"
              max="10"
              data-testid={`pit-places-${i}`}
              value={n}
              onChange={(e) => {
                setCounts(counts.map((v, j) => (i === j ? (e.target.value === '' ? '' : Number(e.target.value)) : v)))
                reset()
              }}
            />
          </label>
        ))}
      </fieldset>
      <label className="planner-pit-toggle">
        <input
          type="checkbox"
          data-testid="pit-lane-change"
          checked={laneChange}
          onChange={(e) => {
            setLaneChange(e.target.checked)
            reset()
          }}
        />
        {t('laneChange')}
      </label>
      <p className="text-sm">{t('laneNote')}</p>
      <Button type="button" data-testid="pit-suggest" onClick={suggest}>
        {t('suggest')}
      </Button>
      {error && (
        <p role="alert" data-testid="pit-error">
          {t(error, { defaultValue: t('configuration') })}
        </p>
      )}
      {applied && (
        <p role="status" data-testid="pit-applied">
          {t('pitApplied')}{' '}
          <Button type="button" variant="outline" onClick={onEditor}>
            {t('showPitOnTrack')}
          </Button>
        </p>
      )}
      {!variants.length && !applied && <p>{t('pitEmpty')}</p>}
      {!!variants.length && (
        <>
          <div className="planner-pit-variants" role="group" aria-label={t('variant')}>
            {variants.map((v, i) => (
              <Button
                key={v.name}
                type="button"
                data-testid={`pit-variant-${v.name}`}
                variant={choice === i ? 'secondary' : 'outline'}
                aria-pressed={choice === i}
                onClick={() => {
                  setChoice(i)
                  setApplied(false)
                  setError('')
                }}
              >
                {t(v.name)} · {v.plan.pieces.length} {t('length')}
              </Button>
            ))}
          </div>
          <svg
            className="planner-pit-preview"
            data-testid="pit-proposal"
            role="img"
            aria-label={t(variant.name)}
            viewBox={(() => {
              const b = trackFootprint(variant.plan)
              return `${b.x - 100} ${b.y - 100} ${b.width + 200} ${b.depth + 200}`
            })()}
          >
            <TrackPlanPreview plan={variant.plan} embedded light />
          </svg>
          <p>{t('pitPreviewNote')}</p>
          <p>
            {counts.join(' + ')} = {places} {t('places')} · {railRequirements(variant.plan).counts['30356']}{' '}
            {t('pitPairs')} · {railRequirements(variant.plan).counts['20517']} {t('fixedCrossPieces')}
          </p>
          <fieldset className="planner-pit-settings">
            <legend>{t('placement')}</legend>
            <label>
              {t('insertionTarget')}
              <select
                data-testid="pit-insert-target"
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value)
                  setApplied(false)
                  setError('')
                }}
              >
                <option value="all">{t('allPit')}</option>
                {counts.map((n, i) => (
                  <option key={i} value={i}>
                    {t('pit')} {i + 1} · {n} {t('places')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('placement')}
              <select
                data-testid="pit-placement"
                value={placement}
                onChange={(e) => {
                  setPlacement(e.target.value)
                  setApplied(false)
                  setError('')
                }}
              >
                <option value="append">{t('appendPit')}</option>
                <option value="replace">{t('replacePit')}</option>
              </select>
            </label>
            {placement === 'append' ? (
              <label>
                {t('connection')}
                <select
                  data-testid="pit-connection"
                  value={port ? `${port.index}:${port.end}` : ''}
                  onChange={(e) => {
                    setConnection(e.target.value)
                    setApplied(false)
                  }}
                >
                  {!ports.length && <option value="">{plan.pieces.length ? t('openPort') : t('origin')}</option>}
                  {ports.map((p) => (
                    <option key={`${p.index}:${p.end}`} value={`${p.index}:${p.end}`}>
                      {p.index + 1} · {p.end ? t('end') : t('start')}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                {t('startRail')}
                <select
                  data-testid="pit-start"
                  value={start}
                  onChange={(e) => {
                    setStart(Number(e.target.value))
                    setApplied(false)
                  }}
                >
                  {plan.pieces.map((p, i) => (
                    <option key={i} value={i}>
                      {i + 1} · {p.type.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>
          <label className="planner-pit-toggle">
            <input
              type="checkbox"
              checked={otherSide}
              onChange={(e) => {
                setOtherSide(e.target.checked)
                setApplied(false)
              }}
            />
            {t('otherSide')}
          </label>
          <p>
            {t('individualInsertNote')} · {insertionTemplate.pieces.length} {t('length')}
          </p>
          {!applied && insertionError && <p role="status">{t(insertionError, { defaultValue: t('configuration') })}</p>}
          {!applied && insertion && (
            <>
              <h3 className="font-semibold">{t('insertionPreview')}</h3>
              <svg
                className="planner-pit-preview"
                data-testid="pit-insertion-preview"
                role="img"
                aria-label={t('insertionPreview')}
                viewBox={(() => {
                  const b = trackFootprint(insertion)
                  return `${b.x - 100} ${b.y - 100} ${b.width + 200} ${b.depth + 200}`
                })()}
              >
                <TrackPlanPreview plan={insertion} embedded light />
              </svg>
            </>
          )}
          <Button type="button" data-testid="pit-apply" disabled={!insertion || applied} onClick={apply}>
            {t('applyPit')}
          </Button>
        </>
      )}
    </section>
  )
}
