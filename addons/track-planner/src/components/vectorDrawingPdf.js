import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'
import { outlinePaintServerStrokes } from './vectorStrokeOutline.js'
import { drawingPdfGeometry, vectorFontWeight } from './drawingPdf.js'
const urls = import.meta.glob('../assets/pdf-fonts/CarreraPlanner*.ttf', {
  query: '?url',
  import: 'default',
  eager: true,
})
const fontCache = new Map()
async function fontData(weight) {
  if (!fontCache.has(weight))
    fontCache.set(
      weight,
      (async () => {
        const family = `CarreraPlanner${weight}`,
          url = urls[`../assets/pdf-fonts/${family}.ttf`]
        if (!url) throw new Error('Missing vector font')
        const r = await fetch(url)
        if (!r.ok) throw new Error('Vector font could not be loaded')
        const bytes = await r.arrayBuffer(),
          face = new FontFace(family, bytes.slice(0), { style: 'normal', weight: 'normal' })
        await face.load()
        document.fonts.add(face)
        let binary = ''
        const data = new Uint8Array(bytes)
        for (let i = 0; i < data.length; i += 8192) binary += String.fromCharCode(...data.subarray(i, i + 8192))
        return { family, base64: btoa(binary) }
      })().catch((e) => {
        fontCache.delete(weight)
        throw e
      }),
    )
  return fontCache.get(weight)
}
export async function vectorDrawingPdf(snapshot, options = {}) {
  const parsed = new DOMParser().parseFromString(snapshot.svg, 'image/svg+xml')
  if (parsed.querySelector('parsererror')) throw new Error('Invalid drawing snapshot')
  const svg = document.importNode(parsed.documentElement, true)
  if (svg.querySelector('image,foreignObject')) throw new Error('Vector export requires vector drawing elements')
  const textNodes = [...svg.querySelectorAll('text,tspan')],
    weights = [...new Set(textNodes.map((n) => vectorFontWeight(n.style.fontWeight || '400')))]
  const loaded = await Promise.all(weights.map(fontData)),
    fonts = new Map(loaded.map((f) => [Number(f.family.replace('CarreraPlanner', '')), f]))
  const g = drawingPdfGeometry(snapshot.box[2], snapshot.box[3], options)
  const pdf = new jsPDF({
    unit: 'pt',
    format: [g.pageWidth, g.pageHeight],
    orientation: g.pageWidth >= g.pageHeight ? 'landscape' : 'portrait',
    compress: true,
    putOnlyUsedFonts: true,
    floatPrecision: 16,
  })
  for (const { family, base64 } of loaded) {
    pdf.addFileToVFS(`${family}.ttf`, base64)
    pdf.addFont(`${family}.ttf`, family, 'normal')
  }
  for (const n of textNodes) {
    const f = fonts.get(vectorFontWeight(n.style.fontWeight || '400'))
    if (n.style.fontStyle && n.style.fontStyle !== 'normal') throw new Error('Unsupported vector font style')
    const font = pdf.getFont(f.family, 'normal')
    for (const ch of n.textContent)
      if (!/\s/.test(ch) && font.metadata.characterToGlyph(ch.codePointAt(0)) === 0)
        throw new Error('Unsupported vector font character')
    n.style.fontFamily = f.family
    n.style.fontWeight = 'normal'
    n.style.fontStyle = 'normal'
  }
  // svg2pdf draws text fill before stroke. SVG paint-order=stroke needs
  // two vector text passes so the white halo cannot cover the coloured glyphs.
  for (const n of textNodes) {
    if (n.style.paintOrder?.startsWith('stroke') && n.style.stroke !== 'none') {
      const halo = n.cloneNode(true)
      halo.style.fill = 'none'
      halo.style.paintOrder = 'normal'
      n.before(halo)
      n.style.stroke = 'none'
      n.style.paintOrder = 'normal'
    }
  }
  svg.querySelectorAll('style').forEach((n) => n.remove())
  const holder = document.createElement('div')
  holder.setAttribute('aria-hidden', 'true')
  Object.assign(holder.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${snapshot.width}px`,
    height: `${snapshot.height}px`,
    opacity: '0',
    pointerEvents: 'none',
  })
  holder.appendChild(svg)
  document.body.appendChild(holder)
  try {
    outlinePaintServerStrokes(svg)
    await svg2pdf(svg, pdf, {
      x: g.x,
      y: g.y,
      width: g.width,
      height: g.height,
      loadExternalStyleSheets: false,
      loadImages: false,
    })
    pdf.setProperties({
      title: 'Carrera Track Planner - vector view',
      subject: 'Frozen view with unchanged label positions',
      creator: 'Carrera Track Planner',
    })
    return new Uint8Array(pdf.output('arraybuffer'))
  } finally {
    holder.remove()
  }
}
