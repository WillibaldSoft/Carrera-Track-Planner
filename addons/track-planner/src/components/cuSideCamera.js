import { traceTrackPlan, trackFootprint } from '@racehubos/shared'
// Look from the CU towards the middle of the track, with enough tilt to show
// both the horizontal layout and vertical bridge clearances.
export function cuSideCamera(plan) {
  const segments = traceTrackPlan(plan).segments,
    cu = segments.find((s) => s.type === 'Control_unit')
  if (!cu) return { yaw: 0, pitch: 35, available: false }
  const b = trackFootprint(plan),
    p = cu.points[0][16]
  let dx = p[0] - (b.x + b.width / 2),
    dy = p[1] - (b.y + b.depth / 2)
  if (Math.hypot(dx, dy) < 1) {
    dx = -Math.sin(cu.start.h)
    dy = Math.cos(cu.start.h)
  }
  return { yaw: (((Math.atan2(dx, dy) * 180) / Math.PI + 540) % 360) - 180, pitch: 35, available: true }
}
