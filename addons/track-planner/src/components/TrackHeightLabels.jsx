import { useRef } from 'react'
import { labelOffsetFromScreen } from './manualHeightLabels.js'
import { useTranslation } from 'react-i18next'
import { heightLabelValue } from './heightLabelLayout.js'
export default function TrackHeightLabels({ model, layout, onPick, onPreview, onCommit, onReset, selected = -1 }) {
  const { t } = useTranslation('planner3D')
  const root = useRef(null),
    drag = useRef(null),
    suppressClick = useRef(false)
  const pixelPoint = (e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(root.current.getScreenCTM().inverse())
  return (
    <g
      ref={root}
      data-testid="track-height-labels"
      transform={`translate(${layout.origin[0]} ${layout.origin[1]}) scale(${layout.unitX} ${layout.unitY})`}
    >
      <g pointerEvents="none" aria-hidden="true">
        {layout.items.map((c) => (
          <g key={c.index}>
            <line
              data-testid="height-label-leader"
              x1={c.anchor.x}
              y1={c.anchor.y}
              x2={c.edge.x}
              y2={c.edge.y}
              stroke={c.index === selected ? '#7c3aed' : '#64748b'}
              strokeWidth={c.index === selected ? 1.5 : 1}
              strokeOpacity=".65"
            />
            <circle cx={c.anchor.x} cy={c.anchor.y} r="2" fill={c.index === selected ? '#7c3aed' : '#64748b'} />
          </g>
        ))}
      </g>
      {layout.items.map((c) => (
        <g
          key={c.index}
          data-testid="track-height-label"
          data-height-rail={c.index}
          data-label-font-size={c.fontSize}
          data-label-manual={c.manual ? 'true' : 'false'}
          data-label-adjusted={c.adjusted ? 'true' : undefined}
          transform={`translate(${c.rect.x} ${c.rect.y})`}
          role="button"
          tabIndex="0"
          aria-label={t('labelEdit', { rail: c.index + 1, height: c.heightText, slope: c.slopeText })}
          onPointerDown={(e) => {
            e.stopPropagation()
            if (e.button !== 0) return
            e.preventDefault()
            e.currentTarget.focus({ preventScroll: true })
            suppressClick.current = false
            const p = pixelPoint(e)
            drag.current = {
              id: e.pointerId,
              index: c.index,
              start: p,
              center: { x: c.rect.x + c.width / 2, y: c.rect.y + c.height / 2 },
              fallbackRect: { ...c.rect },
              moved: false,
              offset: null,
            }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d || d.id !== e.pointerId) return
            e.stopPropagation()
            const p = pixelPoint(e),
              dx = p.x - d.start.x,
              dy = p.y - d.start.y
            if (!d.moved && Math.hypot(dx, dy) < 4) return
            d.moved = true
            d.offset = labelOffsetFromScreen(model, layout, d.index, { x: d.center.x + dx, y: d.center.y + dy })
            onPreview({ index: d.index, offset: d.offset, fallbackRect: d.fallbackRect })
          }}
          onPointerUp={(e) => {
            e.stopPropagation()
            const d = drag.current
            if (!d || d.id !== e.pointerId) return
            drag.current = null
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
            if (d.moved) {
              suppressClick.current = true
              onCommit(d.index, d.offset)
            }
          }}
          onPointerCancel={(e) => {
            e.stopPropagation()
            drag.current = null
            onPreview(null)
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (suppressClick.current) {
              suppressClick.current = false
              return
            }
            onPick(c.index)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              drag.current = null
              onPreview(null)
              return
            }
            if (['Delete', 'Backspace'].includes(e.key)) {
              e.preventDefault()
              e.stopPropagation()
              if (c.manual) onReset(c.index)
              return
            }
            if (!e.ctrlKey && !e.metaKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
              e.preventDefault()
              e.stopPropagation()
              const step = e.shiftKey ? 16 : 4
              onCommit(
                c.index,
                labelOffsetFromScreen(model, layout, c.index, {
                  x: c.rect.x + c.width / 2 + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0),
                  y: c.rect.y + c.height / 2 + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0),
                }),
              )
              return
            }
            if (['Enter', ' '].includes(e.key)) {
              e.preventDefault()
              e.stopPropagation()
              onPick(c.index)
            }
          }}
          style={{ cursor: drag.current?.index === c.index ? 'grabbing' : 'grab', touchAction: 'none' }}
        >
          <title>
            {t('labelEdit', { rail: c.index + 1, height: c.heightText, slope: c.slopeText })} · {t('maxSlope')}:{' '}
            {heightLabelValue(model.metrics[c.index].peakPercent)} % · {t('dragLabelHelp')}{' '}
            {c.manual ? t('manualLabel') : ''} {c.adjusted ? t('adjustedLabel') : ''}
          </title>
          <rect
            width={c.width}
            height={c.height}
            rx="4"
            fill="#f8fafc"
            fillOpacity=".97"
            stroke={c.index === selected ? '#7c3aed' : c.manual ? '#2563eb' : '#94a3b8'}
            strokeWidth={c.index === selected ? 1.5 : 0.8}
          />
          <text
            x={c.width / 2}
            textAnchor="middle"
            fill="#0f172a"
            fontSize={c.fontSize}
            fontWeight="600"
            pointerEvents="none"
          >
            {c.lines.map((line, i) => (
              <tspan key={i} x={c.width / 2} y={5 + c.fontSize + i * c.lineHeight}>
                {line}
              </tspan>
            ))}
          </text>
        </g>
      ))}
    </g>
  )
}
