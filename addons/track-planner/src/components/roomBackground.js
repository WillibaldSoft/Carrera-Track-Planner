import { trackBounds } from '@racehubos/shared'
import { roomFootprint } from '../../../../vendor/racehubos/shared/src/roomFootprint.js'
export { roomFootprint }
export function anchorRoom(room, plan) {
  if (room.backgroundOrigin) return room
  const b = plan.pieces.length ? trackBounds(plan) : { x: 0, y: 0, width: 0, depth: 0 }
  const edge = room.edgeM * 1000
  const availableDepth = (room.depthM - room.driverDepthM - room.aisleM) * 1000 - 2 * edge
  return {
    ...room,
    backgroundOrigin: {
      xMm: Math.round((b.x - edge - (room.widthM * 1000 - 2 * edge - b.width) / 2) * 1000) / 1000,
      yMm: Math.round((b.y - edge - (availableDepth - b.depth) / 2) * 1000) / 1000,
    },
  }
}
export function withRoomAnchor(plan) {
  return plan.roomPlan && !plan.roomPlan.backgroundOrigin
    ? { ...plan, roomPlan: anchorRoom(plan.roomPlan, plan) }
    : plan
}
export function roomAndTrackBounds(plan, track) {
  if (!plan.roomPlan) return track
  const room = anchorRoom(plan.roomPlan, plan),
    b = roomFootprint(room).bounds,
    p = room.backgroundOrigin
  const x = Math.min(track.x, b.x + p.xMm),
    y = Math.min(track.y, b.y + p.yMm)
  return {
    x,
    y,
    width: Math.max(track.x + track.width, b.x + b.width + p.xMm) - x,
    depth: Math.max(track.y + track.depth, b.y + b.depth + p.yMm) - y,
  }
}
