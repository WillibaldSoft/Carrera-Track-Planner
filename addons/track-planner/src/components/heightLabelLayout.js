import { manualLabelWorldCenter } from './manualHeightLabels.js'
import { softyExtraGeometry } from '@racehubos/shared'
import { unitHousingPolygon } from '../../../../vendor/racehubos/shared/src/trackUnitGeometry.js'
import { BORDER_WIDTH_MM } from '../../../../vendor/racehubos/shared/src/trackBorders.js'
export const heightLabelValue = (n) => (Math.abs(n) < 0.05 ? 0 : n).toFixed(1).replace(/\.0$/, '')
const overlaps = (a, b, gap = 4) =>
  a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y
// All layout distances are CSS pixels. Nothing here changes the native plan.
export function layoutTrackHeightLabels({
  model,
  plan,
  box,
  viewport,
  selected = -1,
  visibleLevel = null,
  visibleDrawingLevel = null,
  visibleDrawingLevels = null,
  preview = null,
}) {
  const width = Math.max(1, viewport.width),
    height = Math.max(1, viewport.height),
    sx = width / box[2],
    sy = height / box[3]
  const point = (p) => ({ x: (p[0] - box[0]) * sx, y: (p[1] - box[1]) * sy })
  const tile = 10,
    cols = Math.ceil(width / tile),
    rows = Math.ceil(height / tile),
    occupied = new Set()
  const mark = (r) => {
    const x0 = Math.max(0, Math.floor(r.x / tile)),
      x1 = Math.min(cols - 1, Math.floor((r.x + r.width) / tile))
    const y0 = Math.max(0, Math.floor(r.y / tile)),
      y1 = Math.min(rows - 1, Math.floor((r.y + r.height) / tile))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) occupied.add(y * cols + x)
  }
  const markPolygon = (poly) => {
    if (!poly?.length) return
    const p = poly.map(point),
      xs = p.map((q) => q.x),
      ys = p.map((q) => q.y)
    mark({
      x: Math.min(...xs) - 4,
      y: Math.min(...ys) - 4,
      width: Math.max(...xs) - Math.min(...xs) + 8,
      height: Math.max(...ys) - Math.min(...ys) + 8,
    })
  }
  // Conservative corridor masks also protect shoulders, CU housings and pit rails.
  for (const s of model.segments) {
    if (
      (visibleLevel !== null && s.level !== visibleLevel) ||
      (visibleDrawingLevel !== null && s.level + (s.drawLayer ?? 0) !== visibleDrawingLevel) ||
      (visibleDrawingLevels !== null && !visibleDrawingLevels.includes(s.level + (s.drawLayer ?? 0)))
    )
      continue
    const radius = (99 + (s.borders?.left || s.borders?.right ? BORDER_WIDTH_MM : 0)) * Math.max(sx, sy) + 4
    const pts = s.points[0].map(point)
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i]
      mark({
        x: Math.min(a.x, b.x) - radius,
        y: Math.min(a.y, b.y) - radius,
        width: Math.abs(b.x - a.x) + 2 * radius,
        height: Math.abs(b.y - a.y) + 2 * radius,
      })
    }
    markPolygon(unitHousingPolygon(s))
  }
  for (const e of plan.trackExtras ?? []) {
    const anchor = model.segments[e.anchor]
    const physicalLevel = anchor?.level ?? e.level
    const drawingPlane = physicalLevel + (e.drawLayer ?? anchor?.drawLayer ?? 0)
    if (
      !e.hidden &&
      (visibleLevel === null || physicalLevel === visibleLevel) &&
      (visibleDrawingLevel === null || drawingPlane === visibleDrawingLevel) &&
      (visibleDrawingLevels === null || visibleDrawingLevels.includes(drawingPlane))
    )
      markPolygon(softyExtraGeometry(e, model.segments).polygon)
  }
  const hitsTrack = (r) => {
    for (let y = Math.max(0, Math.floor(r.y / tile)); y <= Math.min(rows - 1, Math.floor((r.y + r.height) / tile)); y++)
      for (
        let x = Math.max(0, Math.floor(r.x / tile));
        x <= Math.min(cols - 1, Math.floor((r.x + r.width) / tile));
        x++
      )
        if (occupied.has(y * cols + x)) return true
    return false
  }
  const candidates = model.segments
    .filter(
      (s) =>
        (visibleLevel === null || s.level === visibleLevel) &&
        (visibleDrawingLevel === null || s.level + (s.drawLayer ?? 0) === visibleDrawingLevel) &&
        (visibleDrawingLevels === null || visibleDrawingLevels.includes(s.level + (s.drawLayer ?? 0))),
    )
    .flatMap((s) => {
      const pts = s.points[0].map(point),
        visible = pts.map((p, i) => ({ ...p, i })).filter((p) => p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height)
      const offset = preview?.index === s.index ? preview.offset : plan.pieces[s.index]?.heightLabelOffset
      const manualCenter = offset ? point(manualLabelWorldCenter(s, offset)) : null
      const manualVisible =
        manualCenter &&
        manualCenter.x >= 0 &&
        manualCenter.x <= width &&
        manualCenter.y >= 0 &&
        manualCenter.y <= height
      if (!visible.length && !manualVisible) return []
      const anchor = visible.length
          ? visible.reduce((a, b) => (Math.abs(a.i - 16) <= Math.abs(b.i - 16) ? a : b))
          : { ...pts[16], i: 16 },
        m = model.metrics[s.index]
      const heightText =
        Math.abs(m.startMm - m.endMm) < 0.05
          ? heightLabelValue(m.startMm)
          : `${heightLabelValue(m.startMm)}→${heightLabelValue(m.endMm)}`
      const slopeText = `${m.meanPercent > 0.05 ? '+' : ''}${heightLabelValue(m.meanPercent)} %`
      const lines = [
        `H ${heightText} mm`,
        slopeText,
        ...(m.clearanceMm === undefined ? [] : [`↕ ${heightLabelValue(m.clearanceMm)} mm`]),
      ]
      const fontSize = Math.max(10, Math.min(12, 10 + (m.lengthMm * sx - 80) / 160)),
        lineHeight = fontSize + 3
      const cardWidth = Math.max(76, ...lines.map((t) => t.length * fontSize * 0.67 + 16)),
        cardHeight = lines.length * lineHeight + 10
      const a = pts[0],
        b = pts.at(-1),
        angle = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2
      const priority =
        s.index === selected
          ? 0
          : plan.pieces[s.index]?.elevation
            ? 1
            : m.clearanceMm !== undefined
              ? 2
              : Math.abs(m.peakPercent) > 0.05
                ? 3
                : 4
      return [
        {
          index: s.index,
          anchor,
          lines,
          heightText,
          slopeText,
          fontSize,
          lineHeight,
          width: cardWidth,
          height: cardHeight,
          angle,
          priority,
          manualCenter,
          manual: !!offset,
          moving: preview?.index === s.index,
          radius: 99 * Math.max(sx, sy),
        },
      ]
    })
    .sort(
      (a, b) =>
        (a.manual ? (a.moving ? 1 : 0) : 2) - (b.manual ? (b.moving ? 1 : 0) : 2) ||
        a.priority - b.priority ||
        a.index - b.index,
    )
  const placed = [],
    hiddenIndices = []
  for (const c of candidates) {
    if (placed.length >= 160) {
      hiddenIndices.push(c.index)
      continue
    }
    const options = []
    const desired = c.manualCenter ?? c.anchor
    const searchCenter = c.manualCenter
      ? {
          x: Math.max(6 + c.width / 2, Math.min(width - 6 - c.width / 2, desired.x)),
          y: Math.max(6 + c.height / 2, Math.min(height - 6 - c.height / 2, desired.y)),
        }
      : c.anchor
    if (c.manual)
      options.push({
        x: desired.x - c.width / 2,
        y: desired.y - c.height / 2,
        width: c.width,
        height: c.height,
        score: -1,
      })
    for (let ring = 0; ring < 10; ring++)
      for (let d = 0; d < 16; d++) {
        const angle = c.angle + (d * Math.PI) / 8,
          dx = Math.cos(angle) * ((c.manual ? 0 : c.radius) + 9 + c.width / 2 + ring * 24),
          dy = Math.sin(angle) * ((c.manual ? 0 : c.radius) + 9 + c.height / 2 + ring * 24)
        options.push({
          x: searchCenter.x + dx - c.width / 2,
          y: searchCenter.y + dy - c.height / 2,
          width: c.width,
          height: c.height,
          score: (searchCenter.x + dx - desired.x) ** 2 + (searchCenter.y + dy - desired.y) ** 2,
        })
      }
    if (c.index === selected || c.manual)
      for (let y = 6; y + c.height <= height - 6; y += 24)
        for (let x = 6; x + c.width <= width - 6; x += 24)
          options.push({
            x,
            y,
            width: c.width,
            height: c.height,
            score: (x + c.width / 2 - desired.x) ** 2 + (y + c.height / 2 - desired.y) ** 2,
          })
    if (c.moving && preview.fallbackRect) options.push({ ...preview.fallbackRect, score: 1e12 })
    options.sort((a, b) => a.score - b.score)
    const rect = options.find(
      (r) =>
        r.x >= 6 &&
        r.y >= 6 &&
        r.x + r.width <= width - 6 &&
        r.y + r.height <= height - 6 &&
        !hitsTrack(r) &&
        !placed.some((p) => overlaps(r, p.rect)),
    )
    if (!rect) {
      hiddenIndices.push(c.index)
      continue
    }
    const edge = {
      x: Math.max(rect.x, Math.min(rect.x + rect.width, c.anchor.x)),
      y: Math.max(rect.y, Math.min(rect.y + rect.height, c.anchor.y)),
    }
    placed.push({
      ...c,
      rect,
      edge,
      adjusted: c.manual && Math.hypot(rect.x + c.width / 2 - desired.x, rect.y + c.height / 2 - desired.y) > 1,
    })
  }
  return {
    items: placed,
    hiddenIndices,
    visibleCount: candidates.length,
    unitX: box[2] / width,
    unitY: box[3] / height,
    origin: [box[0], box[1]],
  }
}
