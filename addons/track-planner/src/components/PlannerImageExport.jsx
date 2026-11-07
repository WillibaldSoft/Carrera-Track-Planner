import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@core/components/ui/button'
import { snapshotDrawing, rasterizeDrawing, downloadDrawingBlob } from './drawingSnapshot.js'
export async function downloadSnapshotPdf(snapshot, name, options) {
  const { vectorDrawingPdf } = await import('./vectorDrawingPdf.js')
  const bytes = await vectorDrawingPdf(snapshot, options)
  downloadDrawingBlob(new Blob([bytes], { type: 'application/pdf' }), `${name}.pdf`)
}
export default function PlannerImageExport({ children, name = 'Carrera', className = '' }) {
  const { t } = useTranslation('tracks'),
    { t: t3 } = useTranslation('planner3D'),
    ref = useRef(null)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false)
  async function download(format) {
    setBusy(true)
    setError(false)
    try {
      const snapshot = await snapshotDrawing(ref.current.querySelector('svg'))
      if (format === 'svg')
        downloadDrawingBlob(new Blob([snapshot.svg], { type: 'image/svg+xml;charset=utf-8' }), `${name}.svg`)
      else if (format === 'pdf') await downloadSnapshotPdf(snapshot, name)
      else downloadDrawingBlob((await rasterizeDrawing(snapshot, { format })).blob, `${name}.${format}`)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div data-testid="planner-image-export" className={`space-y-2 ${className}`}>
      <div ref={ref}>{children}</div>
      <div className="flex flex-wrap gap-2">
        {['png', 'jpg', 'svg', 'pdf'].map((format) => (
          <Button
            key={format}
            data-testid={`export-image-${format}`}
            disabled={busy}
            type="button"
            variant="outline"
            onClick={() => download(format)}
          >
            {format === 'pdf' ? t3('exportPdf') : t('images.export', { format: format.toUpperCase() })}
          </Button>
        ))}
      </div>
      {error && <p role="alert">{t('images.error')}</p>}
    </div>
  )
}
