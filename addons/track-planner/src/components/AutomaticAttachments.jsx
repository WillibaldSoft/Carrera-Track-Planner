import { useTranslation } from 'react-i18next'
import { Button } from '@core/components/ui/button'
export default function AutomaticAttachments({
  index,
  options,
  onPreview,
  onAdd,
  onClose,
  side,
  onSideChange,
  onApply,
  canApply,
  reverse,
}) {
  const { t } = useTranslation('plannerActions')
  return (
    <section data-testid="automatic-attachments" className="planner-auto-attachments" aria-label={t('automatic')}>
      <div className="flex justify-between gap-2">
        <strong>{index >= 0 ? t('target', { number: index + 1 }) : t('automatic')}</strong>
        <Button type="button" variant="outline" onClick={onClose} aria-label={t('close')}>
          ×
        </Button>
      </div>
      <label className="flex items-center gap-2">
        {t('side')}
        <select data-testid="auto-border-side" value={side} onChange={(e) => onSideChange(e.target.value)}>
          {['left', 'right', 'both'].map((value) => (
            <option key={value} value={value}>
              {t(value)}
            </option>
          ))}
        </select>
      </label>
      <p>{t('continueHint')}</p>
      <Button type="button" data-testid="auto-attach-continue" disabled={!canApply} onClick={onApply}>
        {t('applyNext')}
      </Button>
      <p>{t('hint')}</p>
      {!options.length && <p>{t('none')}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o.id}
            type="button"
            variant="outline"
            data-testid={`auto-attach-${o.id}`}
            onPointerEnter={() => onPreview(o.id)}
            onFocus={() => onPreview(o.id)}
            onPointerLeave={() => onPreview(null)}
            onBlur={() => onPreview(null)}
            onClick={() => onAdd(o.id)}
          >
            {t(o.kind)} · {t(reverse ? (o.side === 'left' ? 'right' : 'left') : o.side)} · {o.article}
          </Button>
        ))}
      </div>
    </section>
  )
}
