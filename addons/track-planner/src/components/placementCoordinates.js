// New mouse placements get finite, millimetre coordinates with 0.001 mm precision.
// Existing snapped joints are retained at full precision by the geometry engine.
export function placementCoordinates(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  const coordinate = (n) => Math.round(Math.max(-990000, Math.min(990000, n)) * 1000) / 1000 || 0
  return { x: coordinate(point.x), y: coordinate(point.y) }
}
