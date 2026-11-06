import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@core/components/ui/button'
import { dockingFrame, parallelDockingPreview } from './parallelDocking'
export default function ParallelDockingPanel({ plan, selectionRefs, currentRef, onPreview, onApply }) {
  const { t } = useTranslation('plannerEditing')
  const [remembered, setRemembered] = useState(null),
    [side, setSide] = useState('right'),
    [spacing, setSpacing] = useState('auto'),
    [custom, setCustom] = useState('198'),
    [opposite, setOpposite] = useState(false),
    [request, setRequest] = useState(null)
  const fixed = selectionRefs.length === 2 ? selectionRefs[0] : remembered?.plan === plan ? remembered.ref : null
  const moving = selectionRefs.length === 2 ? selectionRefs[1] : currentRef
  let auto = 198
  try {
    if (fixed && moving) auto = (dockingFrame(plan, fixed).width + dockingFrame(plan, moving).width) / 2
  } catch {
    /* Selection explanation is displayed below. */
  }
  const distance = spacing === 'auto' ? auto : spacing === 'custom' ? Number(custom) : Number(spacing)
  const signature = JSON.stringify({ fixed, moving, side, distance, opposite })
  const current = request?.base === plan && request.signature === signature ? request : null
  const preview = current?.result ?? null
  useEffect(() => {
    onPreview(preview)
  }, [preview, onPreview])
  useEffect(() => () => onPreview(null), [onPreview])
  function propose() {
    try {
      setRequest({
        base: plan,
        signature,
        result: parallelDockingPreview(plan, fixed, moving, { side, distanceMm: distance, opposite }),
      })
    } catch (e) {
      setRequest({ base: plan, signature, error: e.message })
    }
  }
  return (
    <details data-testid="parallel-docking-controls" className="planner-parallel-controls border rounded-lg p-2">
      <summary>{t('parallel.title')}</summary>
      <p className="text-xs">{t('parallel.help')}</p>
      <Button
        type="button"
        variant="outline"
        data-testid="parallel-reference"
        disabled={!currentRef}
        onClick={() => {
          setRemembered({ plan, ref: currentRef })
          setRequest(null)
        }}
      >
        {t('parallel.remember')}
      </Button>
      <p data-testid="parallel-reference-status" className="text-xs">
        {fixed
          ? t('parallel.reference', { number: fixed.index + 1, kind: t(`parallel.${fixed.kind}`) })
          : t('parallel.noReference')}
      </p>
      <label>
        {t('parallel.side')}
        <select data-testid="parallel-side" value={side} onChange={(e) => setSide(e.target.value)}>
          <option value="right">{t('parallel.right')}</option>
          <option value="left">{t('parallel.left')}</option>
        </select>
      </label>
      <label>
        {t('parallel.spacing')}
        <select data-testid="parallel-spacing" value={spacing} onChange={(e) => setSpacing(e.target.value)}>
          <option value="auto">{t('parallel.auto', { distance: auto })}</option>
          <option value="198">198 mm</option>
          <option value="148.5">148.5 mm</option>
          <option value="99">99 mm</option>
          <option value="custom">{t('parallel.custom')}</option>
        </select>
      </label>
      {spacing === 'custom' && (
        <input
          data-testid="parallel-custom-spacing"
          type="number"
          min="1"
          max="10000"
          step="any"
          aria-label={t('parallel.spacing')}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
      )}
      <label>
        <input
          data-testid="parallel-opposite"
          type="checkbox"
          checked={opposite}
          onChange={(e) => setOpposite(e.target.checked)}
        />
        {t('parallel.opposite')}
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          data-testid="parallel-preview"
          disabled={!fixed || !moving}
          onClick={propose}
        >
          {t('parallel.preview')}
        </Button>
        <Button
          type="button"
          data-testid="parallel-apply"
          disabled={!preview}
          onClick={() => {
            onApply(preview.plan)
            setRequest(null)
            setRemembered(null)
          }}
        >
          {t('parallel.apply')}
        </Button>
        {preview && (
          <Button type="button" variant="outline" data-testid="parallel-cancel" onClick={() => setRequest(null)}>
            {t('parallel.cancel')}
          </Button>
        )}
      </div>
      {current?.error && (
        <p role="alert" data-testid="parallel-error">
          {t(`parallel.errors.${current.error}`, { defaultValue: t('parallel.errors.selectParts') })}
        </p>
      )}
      {preview && (
        <p role="status" data-testid="parallel-preview-status">
          {t('parallel.previewReady', { distance })}
        </p>
      )}
    </details>
  )
}
