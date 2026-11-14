import { compatiblePorts } from '../../../../vendor/racehubos/shared/src/trackConnections.js'
// Distances follow the horizontal track centreline, including curves.
export const DEFAULT_RAMPS = Object.freeze({ ascentLengthMm: 1000, descentLengthMm: 1000 })
export function buildRampProfiles(
  segments,
  settings = DEFAULT_RAMPS,
  spacing = 160,
  base = 0,
  pinned = new Set(),
  anchors = new Map(),
) {
  const length = (s) =>
    s.points[0].slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - s.points[0][i][0], p[1] - s.points[0][i][1]), 0)
  const fixed = (s) => pinned.has(s.index) || ['Control_unit', 'AdapterUnit'].includes(s.type)
  const next = segments.map((s) => {
    const candidates = segments.filter(
      (q) =>
        q.index !== s.index &&
        compatiblePorts({ ...s.end, index: s.index }, { ...q.start, h: q.start.h + Math.PI, index: q.index }),
    )
    return candidates.length === 1 ? candidates[0].index : -1
  })
  const incoming = segments.map((s) => next.filter((i) => i === s.index).length)
  const visited = new Set(),
    profiles = [],
    ramps = []
  const ordered = [...segments.filter((s) => incoming[s.index] !== 1), ...segments.filter(fixed), ...segments]
  for (const seed of ordered) {
    if (visited.has(seed.index)) continue
    const chain = []
    let i = seed.index
    while (i >= 0 && !visited.has(i)) {
      visited.add(i)
      chain.push(segments[i])
      i = next[i]
    }
    const positions = [0]
    for (const s of chain) positions.push(positions.at(-1) + length(s))
    if (chain.some((s) => anchors.has(s.index))) {
      const points = []
      const put = (x, z) => points.push({ x, z })
      for (let k = 0; k < chain.length; k++) {
        const s = chain[k],
          custom = anchors.get(s.index)
        if (custom) {
          put(positions[k], base + custom.heightMm)
          if (custom.flat) put(positions[k + 1], base + custom.heightMm)
        } else if (fixed(s)) {
          put(positions[k], base + (s.level ?? 0) * spacing)
          put(positions[k + 1], base + (s.level ?? 0) * spacing)
        }
      }
      if (!points.some((p) => p.x === 0)) put(0, base + (chain[0].level ?? 0) * spacing)
      if (!points.some((p) => Math.abs(p.x - positions.at(-1)) < 1e-8)) {
        const z = i === seed.index ? points.find((p) => p.x === 0).z : base + (chain.at(-1).level ?? 0) * spacing
        put(positions.at(-1), z)
      }
      points.sort((a, b) => a.x - b.x)
      for (let k = 1; k < points.length; k++) {
        const a = points[k - 1],
          b = points[k],
          rise = b.z - a.z,
          len = b.x - a.x
        if (Math.abs(rise) < 1e-8) continue
        const mean = len > 1e-8 ? (Math.abs(rise) / len) * 100 : null
        ramps.push({
          index: ramps.length,
          custom: true,
          up: rise > 0,
          requestedLengthMm: len,
          lengthMm: len,
          riseMm: Math.abs(rise),
          meanPercent: mean,
          maxPercent: mean === null ? null : mean * 1.875,
          clipped: len < 1e-8,
        })
      }
      const at = (x) => {
        let a = points[0]
        for (const b of points.slice(1)) {
          if (x < b.x) {
            const t = Math.max(0, Math.min(1, (x - a.x) / (b.x - a.x || 1))),
              ease = t * t * t * (10 + t * (-15 + 6 * t))
            return a.z + (b.z - a.z) * ease
          }
          a = b
        }
        return a.z
      }
      for (let k = 0; k < chain.length; k++) {
        const a = positions[k],
          len = positions[k + 1] - a,
          sample = (t) => at(a + Math.max(0, Math.min(1, t)) * len)
        profiles[chain[k].index] = {
          start: sample(0),
          end: sample(1),
          sample,
          sloped: Array.from({ length: 33 }, (_, j) => sample(j / 32)).some((z) => Math.abs(z - sample(0)) > 1e-7),
        }
      }
      continue
    }
    const transitions = []
    for (let k = 1; k < chain.length; k++) {
      const from = chain[k - 1].level ?? 0,
        to = chain[k].level ?? 0
      if (from !== to) transitions.push({ k, at: positions[k], from, to })
    }
    if (i === seed.index && (chain.at(-1).level ?? 0) !== (chain[0].level ?? 0))
      transitions.push({
        k: chain.length,
        at: positions.at(-1),
        from: chain.at(-1).level ?? 0,
        to: chain[0].level ?? 0,
      })
    for (let n = 0; n < transitions.length; n++) {
      const r = transitions[n],
        up = r.to > r.from
      const requested = settings[up ? 'ascentLengthMm' : 'descentLengthMm'] ?? 1000
      let left = n ? (transitions[n - 1].at + r.at) / 2 : 0
      let right = n + 1 < transitions.length ? (r.at + transitions[n + 1].at) / 2 : positions.at(-1)
      for (let k = 0; k < chain.length; k++)
        if (fixed(chain[k])) {
          if (k < r.k) left = Math.max(left, positions[k + 1])
          else right = Math.min(right, positions[k])
        }
      const actual = Math.max(0, Math.min(requested, right - left))
      const shift = settings[up ? 'ascentShiftMm' : 'descentShiftMm'] ?? 0
      const originalStart = Math.max(left, Math.min(r.at - actual / 2, right - actual))
      const start = Math.max(left, Math.min(originalStart + shift, right - actual))
      Object.assign(r, { start, end: start + actual })
      const rise = (r.to - r.from) * spacing,
        mean = actual ? (Math.abs(rise) / actual) * 100 : null
      ramps.push({
        index: ramps.length,
        up,
        requestedLengthMm: requested,
        appliedShiftMm: start - originalStart,
        startAlongMm: start,
        chainBoundariesMm: positions,
        lengthMm: actual,
        riseMm: Math.abs(rise),
        meanPercent: mean,
        maxPercent: mean === null ? null : mean * 1.875,
        clipped: actual + 0.01 < requested,
      })
    }
    const heightAt = (x) => {
      let level = chain[0].level ?? 0
      for (const r of transitions) {
        if (x < r.start) break
        if (x >= r.end) {
          level = r.to
          continue
        }
        const t = (x - r.start) / (r.end - r.start),
          ease = t * t * t * (10 + t * (-15 + 6 * t))
        return base + (r.from + (r.to - r.from) * ease) * spacing
      }
      return base + level * spacing
    }
    for (let k = 0; k < chain.length; k++) {
      const a = positions[k],
        len = positions[k + 1] - a
      const sample = (t) => heightAt(a + Math.max(0, Math.min(1, t)) * len)
      profiles[chain[k].index] = {
        start: sample(0),
        end: sample(1),
        sample,
        sloped: Array.from({ length: 33 }, (_, j) => sample(j / 32)).some((z) => Math.abs(z - sample(0)) > 1e-7),
      }
    }
  }
  return { profiles, ramps }
}
