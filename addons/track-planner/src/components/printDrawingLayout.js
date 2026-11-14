export function printDrawingBox(bounds, rotation = 0) {
  const center = [bounds.x + bounds.width / 2, bounds.y + bounds.depth / 2]
  const radians = (Number(rotation) * Math.PI) / 180
  const width = Math.abs(bounds.width * Math.cos(radians)) + Math.abs(bounds.depth * Math.sin(radians)) + 200
  const depth = Math.abs(bounds.width * Math.sin(radians)) + Math.abs(bounds.depth * Math.cos(radians)) + 200
  return { center, box: [center[0] - width / 2, center[1] - depth / 2, width, depth] }
}
