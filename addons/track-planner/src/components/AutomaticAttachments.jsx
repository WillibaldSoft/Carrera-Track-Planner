import { useTranslation } from 'react-i18next'
import { Button } from '@core/components/ui/button'
export default function AutomaticAttachments({ index, options, onPreview, onAdd, onClose }) {
  const { t } = useTranslation('plannerActions')
  return (
    <section data-testid="automatic-attachments" className="planner-auto-attachments" aria-label={t('automatic')}>
      <div className="flex justify-between gap-2">
        <strong>{t('target', { number: index + 1 })}</strong>
        <Button type="button" variant="outline" onClick={onClose} aria-label={t('close')}>
          ×
        </Button>
      </div>
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
            {t(o.kind)} · {t(o.side)} · {o.article}
          </Button>
        ))}
      </div>
    </section>
  )
}
