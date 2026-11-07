import { validateHeightLabelOffset } from '../../../../vendor/racehubos/shared/src/trackPlan.js'
export function railLabelFrame(segment) {
  const p = segment.points[0][16],
    a = segment.points[0][15],
    b = segment.points[0][17]
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = Math.hypot(dx, dy) || 1
  return { x: p[0], y: p[1], tx: dx / length, ty: dy / length }
}
export function manualLabelWorldCenter(segment, offset) {
  const f = railLabelFrame(segment)
  return [f.x + offset.alongMm * f.tx - offset.acrossMm * f.ty, f.y + offset.alongMm * f.ty + offset.acrossMm * f.tx]
}
export function labelOffsetFromScreen(model, layout, index, point) {
  const f = railLabelFrame(model.segments[index]),
    dx = layout.origin[0] + point.x * layout.unitX - f.x,
    dy = layout.origin[1] + point.y * layout.unitY - f.y
  return validateHeightLabelOffset({
    alongMm: Math.round((dx * f.tx + dy * f.ty) * 1000) / 1000,
    acrossMm: Math.round((-dx * f.ty + dy * f.tx) * 1000) / 1000,
  })
}
export function setHeightLabelOffset(plan, index, offset) {
  if (!plan.pieces[index]) throw new Error('Invalid label rail')
  const value = validateHeightLabelOffset(offset)
  return { ...plan, pieces: plan.pieces.map((p, i) => (i === index ? { ...p, heightLabelOffset: value } : p)) }
}
export function resetHeightLabelOffsets(plan, index) {
  return {
    ...plan,
    pieces: plan.pieces.map((p, i) => {
      if (index !== undefined && i !== index) return p
      const next = { ...p }
      delete next.heightLabelOffset
      return next
    }),
  }
}
