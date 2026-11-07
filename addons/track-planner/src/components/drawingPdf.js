export function drawingPdfGeometry(width, height, { paper = 'A4', orientation } = {}) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error('Invalid image size')
  if (!['A4', 'A3'].includes(paper) || (orientation && !['portrait', 'landscape'].includes(orientation)))
    throw new Error('Invalid paper')
  let [pw, ph] = (paper === 'A3' ? [297, 420] : [210, 297]).map((mm) => (mm * 72) / 25.4)
  if ((orientation ?? (width >= height ? 'landscape' : 'portrait')) === 'landscape') [pw, ph] = [ph, pw]
  const margin = (10 * 72) / 25.4,
    scale = Math.min((pw - 2 * margin) / width, (ph - 2 * margin) / height),
    w = width * scale,
    h = height * scale
  return { pageWidth: pw, pageHeight: ph, x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h }
}
// Exported drawing weights are exact static instances, not raster approximations.
export function vectorFontWeight(value) {
  const n = value === 'normal' ? 400 : value === 'bold' ? 700 : Number(value)
  if (!Number.isInteger(n) || n < 100 || n > 900 || n % 100 !== 0) throw new Error('Unsupported vector font weight')
  return n
}
