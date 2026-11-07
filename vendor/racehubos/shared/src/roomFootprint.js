// Planner-owned rectangular room additions and exclusions, in metres.
const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max
export function roomRect(r) {
  return { x: r.xM, y: r.yM, w: r.widthM, h: r.depthM }
}
const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
const overlapY = (a, b) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
const connected = (a, b) =>
  (overlap(a, b) > 1e-8 && overlapY(a, b) >= -1e-8) || (overlapY(a, b) > 1e-8 && overlap(a, b) >= -1e-8)
export function validateRoomFootprint(room) {
  const result = {}
  if (room.features !== undefined) {
    if (!Array.isArray(room.features) || room.features.length > 32) throw new Error('Invalid room features')
    const ids = new Set()
    result.features = room.features.map((f) => {
      if (
        !f ||
        typeof f.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(f.id) ||
        ids.has(f.id) ||
        !['obstacle', 'extension'].includes(f.kind) ||
        typeof f.name !== 'string' ||
        f.name.length > 100 ||
        !finite(f.xM, -30, 60) ||
        !finite(f.yM, -30, 60) ||
        !finite(f.widthM, 0.05, 30) ||
        !finite(f.depthM, 0.05, 30)
      )
        throw new Error('Invalid room feature')
      ids.add(f.id)
      return { id: f.id, kind: f.kind, name: f.name, xM: f.xM, yM: f.yM, widthM: f.widthM, depthM: f.depthM }
    })
    const joined = [{ x: 0, y: 0, w: room.widthM, h: room.depthM }]
    let remaining = result.features.filter((f) => f.kind === 'extension').map(roomRect)
    while (remaining.length) {
      const next = remaining.filter((f) => joined.some((r) => connected(r, f)))
      if (!next.length) throw new Error('Disconnected room extension')
      joined.push(...next)
      remaining = remaining.filter((f) => !next.includes(f))
    }
    for (const f of result.features.filter((f) => f.kind === 'obstacle'))
      if (!joined.some((r) => overlap(r, roomRect(f)) > 0 && overlapY(r, roomRect(f)) > 0))
        throw new Error('Obstacle outside room')
  }
  if (room.backgroundOrigin !== undefined) {
    const p = room.backgroundOrigin
    if (!p || !finite(p.xMm, -1e7, 1e7) || !finite(p.yMm, -1e7, 1e7)) throw new Error('Invalid room origin')
    result.backgroundOrigin = { xMm: p.xMm, yMm: p.yMm }
  }
  return result
}
export function roomFootprint(room) {
  const base = { x: 0, y: 0, w: room.widthM, h: room.depthM }
  const additions = [base, ...(room.features || []).filter((f) => f.kind === 'extension').map(roomRect)]
  const obstacles = (room.features || []).filter((f) => f.kind === 'obstacle').map(roomRect)
  const rects = [...additions, ...obstacles]
  const xs = [...new Set(rects.flatMap((r) => [r.x, r.x + r.w]))].sort((a, b) => a - b)
  const ys = [...new Set(rects.flatMap((r) => [r.y, r.y + r.h]))].sort((a, b) => a - b)
  const inside = (r, x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h
  const cells = [],
    set = new Set()
  let areaM2 = 0
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      const x = (xs[i] + xs[i + 1]) / 2,
        y = (ys[j] + ys[j + 1]) / 2
      if (additions.some((r) => inside(r, x, y)) && !obstacles.some((r) => inside(r, x, y))) {
        cells.push({ i, j, x: xs[i], y: ys[j], w: xs[i + 1] - xs[i], h: ys[j + 1] - ys[j] })
        set.add(`${i},${j}`)
        areaM2 += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j])
      }
    }
  const edge = []
  for (const c of cells) {
    const { i, j, x, y, w, h } = c
    if (!set.has(`${i - 1},${j}`)) edge.push([x, y, x, y + h])
    if (!set.has(`${i + 1},${j}`)) edge.push([x + w, y, x + w, y + h])
    if (!set.has(`${i},${j - 1}`)) edge.push([x, y, x + w, y])
    if (!set.has(`${i},${j + 1}`)) edge.push([x, y + h, x + w, y + h])
  }
  return {
    cells,
    areaM2,
    outline: edge.map((e) => `M${e[0] * 1000} ${e[1] * 1000}L${e[2] * 1000} ${e[3] * 1000}`).join(''),
    bounds: {
      x: Math.min(...additions.map((r) => r.x)) * 1000,
      y: Math.min(...additions.map((r) => r.y)) * 1000,
      width: (Math.max(...additions.map((r) => r.x + r.w)) - Math.min(...additions.map((r) => r.x))) * 1000,
      depth: (Math.max(...additions.map((r) => r.y + r.h)) - Math.min(...additions.map((r) => r.y))) * 1000,
    },
  }
}
