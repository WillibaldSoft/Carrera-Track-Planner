import latinUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'
import latinExtUrl from '@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?url'
const presentation = [
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'paint-order',
  'vector-effect',
  'clip-path',
  'color',
]
let fontPromise
const dataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
async function fonts() {
  if (!fontPromise)
    fontPromise = Promise.all(
      [latinUrl, latinExtUrl].map(async (url) => {
        const r = await fetch(url)
        if (!r.ok) throw new Error('Font export failed')
        return dataUrl(await r.blob())
      }),
    ).then(
      ([latin, ext]) =>
        `@font-face{font-family:'Inter Variable';font-style:normal;font-weight:100 900;src:url(${ext}) format('woff2');unicode-range:U+0100-02FF,U+1E00-1EFF,U+20A0-20AB,U+20AD-20C0;}@font-face{font-family:'Inter Variable';font-style:normal;font-weight:100 900;src:url(${latin}) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}`,
    )
  return fontPromise
}
export async function snapshotDrawing(original) {
  if (!original?.viewBox) throw new Error('No drawing')
  await document.fonts.ready
  const svg = original.cloneNode(true),
    nodes = [original, ...original.querySelectorAll('*')],
    copies = [svg, ...svg.querySelectorAll('*')]
  for (let i = 0; i < nodes.length; i++) {
    const style = getComputedStyle(nodes[i])
    for (const key of presentation) {
      const value = style.getPropertyValue(key)
      if (value) copies[i].style.setProperty(key, value.replace(/url\(["']?[^)"']*#([^)"']+)["']?\)/g, 'url(#$1)'))
    }
    copies[i].removeAttribute('tabindex')
  }
  const b = original.viewBox.baseVal,
    box = [b.x, b.y, b.width, b.height]
  if (!box.every(Number.isFinite) || b.width <= 0 || b.height <= 0) throw new Error('Invalid drawing bounds')
  const bounds = original.getBoundingClientRect(),
    width = Math.max(1, Math.round(bounds.width)),
    height = Math.max(1, Math.round(bounds.height))
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  svg.setAttribute('width', width)
  svg.setAttribute('height', height)
  svg.removeAttribute('class')
  svg.style.removeProperty('width')
  svg.style.removeProperty('height')
  svg.style.removeProperty('min-height')
  svg.style.removeProperty('max-height')
  svg.style.removeProperty('display')
  svg.style.removeProperty('border')
  svg.style.removeProperty('border-radius')
  svg.style.removeProperty('cursor')
  const color = getComputedStyle(original).backgroundColor,
    backgroundColor = color && color !== 'rgba(0, 0, 0, 0)' ? color : '#ffffff'
  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  for (const [key, value] of Object.entries({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    fill: backgroundColor,
  }))
    background.setAttribute(key, value)
  svg.insertBefore(background, svg.firstChild)
  const fontStyle = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  fontStyle.textContent = await fonts()
  svg.insertBefore(fontStyle, svg.firstChild)
  const text = new XMLSerializer().serializeToString(svg)
  return {
    svg: text,
    url: await dataUrl(new Blob([text], { type: 'image/svg+xml;charset=utf-8' })),
    width,
    height,
    box,
    backgroundColor,
  }
}
export async function rasterizeDrawing(snapshot, { maxSize = 2400, format = 'png' } = {}) {
  const image = new Image()
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
    image.src = snapshot.url
  })
  const ratio = snapshot.box[2] / snapshot.box[3],
    width = Math.round(ratio >= 1 ? maxSize : maxSize * ratio),
    height = Math.round(ratio >= 1 ? maxSize / ratio : maxSize)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, width)
  canvas.height = Math.max(1, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = snapshot.backgroundColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.98),
  )
  if (!blob) throw new Error('Image export failed')
  canvas.width = 0
  canvas.height = 0
  return { blob, width, height }
}
export function downloadDrawingBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
