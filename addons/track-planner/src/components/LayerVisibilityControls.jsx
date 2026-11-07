import { Popover } from 'radix-ui'
import { Layers, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@core/components/ui/button'
export default function LayerVisibilityControls({ levels, visible, onChange, insertion, onInsertion }) {
  const { t } = useTranslation('plannerActions')
  const shown = visible === null ? levels : visible
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button type="button" variant="outline" data-testid="layer-visibility-toggle">
          <Layers size={16} />
          {t('layers.title')} ·{' '}
          {visible === null ? t('layers.all') : shown.length ? shown.join(', ') : t('layers.none')}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          onKeyDown={(e) => e.stopPropagation()}
          className="planner-layer-popover"
          sideOffset={8}
          align="start"
          collisionPadding={12}
          aria-label={t('layers.title')}
        >
          <div className="planner-layer-heading">
            <strong>{t('layers.title')}</strong>
            <Popover.Close asChild>
              <button type="button" aria-label={t('layers.close')}>
                <X size={18} />
              </button>
            </Popover.Close>
          </div>
          <p>{t('layers.help')}</p>
          <div className="planner-layer-actions">
            <Button type="button" variant="outline" data-testid="layers-show-all" onClick={() => onChange(null)}>
              {t('layers.showAll')}
            </Button>
            <Button type="button" variant="outline" data-testid="layers-hide-all" onClick={() => onChange([])}>
              {t('layers.hideAll')}
            </Button>
          </div>
          <fieldset>
            <legend className="sr-only">{t('layers.title')}</legend>
            {levels.map((n) => (
              <div key={n} className="planner-layer-row">
                <label>
                  <input
                    type="checkbox"
                    data-testid={`visible-layer-${n}`}
                    checked={shown.includes(n)}
                    onChange={(e) => onChange(e.target.checked ? [...shown, n] : shown.filter((x) => x !== n))}
                  />
                  {t('layers.layer', { level: n })}
                </label>
                <button
                  type="button"
                  data-testid={`only-layer-${n}`}
                  aria-label={t('layers.onlyLabel', { level: n })}
                  onClick={() => {
                    onInsertion(n)
                    onChange([n])
                  }}
                >
                  {t('layers.only')}
                </button>
              </div>
            ))}
          </fieldset>
          {visible !== null && shown.length > 1 && (
            <label className="planner-layer-insertion">
              {t('layers.insertion')}
              <select
                data-testid="layer-insertion-plane"
                value={insertion}
                onChange={(e) => onInsertion(Number(e.target.value))}
              >
                {shown.map((n) => (
                  <option key={n} value={n}>
                    {t('layers.layer', { level: n })}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p role="status" data-testid="layer-isolation-status">
            {shown.length ? t('layers.shown', { levels: shown.join(', ') }) : t('layers.empty')}
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
