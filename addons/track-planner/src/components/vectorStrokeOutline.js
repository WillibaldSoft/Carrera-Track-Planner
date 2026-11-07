// SVG paint-server strokes are outlined before PDF conversion. The converter
// supports pattern/gradient fills, but silently drops those paints on strokes.
export function outlinePaintServerStrokes(svg) {
  const ns = 'http://www.w3.org/2000/svg'
  // Reflecting axial gradients need explicit mirrored stops in a repeating tile.
  for (const gradient of [...svg.querySelectorAll('linearGradient[spreadMethod="reflect"]')]) {
    const x1 = Number(gradient.getAttribute('x1') || 0),
      y1 = Number(gradient.getAttribute('y1') || 0)
    const dx = Number(gradient.getAttribute('x2')) - x1,
      dy = Number(gradient.getAttribute('y2')) - y1
    const length = Math.hypot(dx, dy),
      id = gradient.id
    if (!length) continue
    const copy = gradient.cloneNode(false)
    copy.id = `${id}-pdf-gradient`
    copy.setAttribute('x1', '0')
    copy.setAttribute('y1', '0')
    copy.setAttribute('x2', String(length * 2))
    copy.setAttribute('y2', '0')
    copy.setAttribute('spreadMethod', 'pad')
    const stops = [...gradient.querySelectorAll('stop')]
    for (const [list, reverse] of [
      [stops, false],
      [[...stops].reverse(), true],
    ])
      for (const stop of list) {
        const child = stop.cloneNode(true),
          raw = stop.getAttribute('offset')
        const value = parseFloat(raw) / (raw.endsWith('%') ? 100 : 1)
        child.setAttribute('offset', String(reverse ? 1 - value / 2 : value / 2))
        copy.appendChild(child)
      }
    const pattern = document.createElementNS(ns, 'pattern')
    pattern.id = id
    pattern.setAttribute('patternUnits', 'userSpaceOnUse')
    pattern.setAttribute('width', String(length * 2))
    pattern.setAttribute('height', '1')
    pattern.setAttribute('patternTransform', `translate(${x1} ${y1}) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI})`)
    const rect = document.createElementNS(ns, 'rect')
    rect.setAttribute('width', String(length * 2))
    rect.setAttribute('height', '1')
    rect.style.fill = `url(#${copy.id})`
    rect.style.stroke = 'none'
    pattern.appendChild(rect)
    gradient.replaceWith(copy, pattern)
  }
  for (const node of [...svg.querySelectorAll('path')]) {
    const stroke = node.style.stroke || node.getAttribute('stroke') || ''
    if (!stroke.startsWith('url(')) continue
    const width = parseFloat(node.style.strokeWidth || node.getAttribute('stroke-width'))
    const length = node.getTotalLength()
    if (!(width > 0 && length > 0)) continue
    // Sub-millimetre sampling keeps curved slots smooth even at print zoom.
    const count = Math.max(2, Math.ceil(length / 0.5)),
      left = [],
      right = []
    for (let i = 0; i <= count; i++) {
      const at = (length * i) / count,
        p = node.getPointAtLength(at)
      const a = node.getPointAtLength(Math.max(0, at - 0.01))
      const b = node.getPointAtLength(Math.min(length, at + 0.01))
      const size = Math.hypot(b.x - a.x, b.y - a.y)
      const nx = ((-(b.y - a.y) / size) * width) / 2,
        ny = (((b.x - a.x) / size) * width) / 2
      left.push(`${p.x + nx},${p.y + ny}`)
      right.push(`${p.x - nx},${p.y - ny}`)
    }
    const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    for (const a of node.attributes) outline.setAttribute(a.name, a.value)
    outline.setAttribute('d', `M${left.join(' L')} L${right.reverse().join(' L')} Z`)
    outline.style.fill = stroke
    outline.style.stroke = 'none'
    outline.setAttribute('fill', stroke)
    outline.setAttribute('stroke', 'none')
    // A solid underlay prevents contrasting hairline seams between PDF tiles.
    const reference = stroke.match(/#([^"')]+)/)?.[1]
    const paint = [...svg.querySelectorAll('[id]')].find((n) => n.id === reference)
    const background = paint?.querySelector('rect')
    if (paint?.tagName === 'pattern' && background && !background.style.fill.startsWith('url(')) {
      const base = outline.cloneNode(true)
      base.style.fill = background.style.fill || background.getAttribute('fill')
      node.before(base)
    }
    node.replaceWith(outline)
  }
}
