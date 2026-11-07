import test from 'node:test'
import assert from 'node:assert/strict'
import { drawingPdfGeometry, vectorFontWeight } from '../addons/track-planner/src/components/drawingPdf.js'
test('paper fitting preserves drawing aspect ratio and positive printable margins', () => {
  for (const paper of ['A4', 'A3'])
    for (const orientation of ['portrait', 'landscape']) {
      const g = drawingPdfGeometry(1200, 700, { paper, orientation })
      assert.ok(Math.abs(g.width / g.height - 1200 / 700) < 1e-8)
      assert.ok(g.x >= 28 && g.y >= 28)
      assert.ok(g.width + 2 * g.x <= g.pageWidth + 0.001)
      assert.equal(g.pageWidth > g.pageHeight, orientation === 'landscape')
    }
})
test('vector font weights retain exact captured weight variants', () => {
  assert.equal(vectorFontWeight('normal'), 400)
  assert.equal(vectorFontWeight('bold'), 700)
  for (const weight of [100, 400, 500, 600, 700, 800, 900]) assert.equal(vectorFontWeight(String(weight)), weight)
})
test('invalid image and paper inputs are rejected rather than producing malformed files', () => {
  for (const [w, h] of [
    [0, 1],
    [1, -1],
    [NaN, 1],
    [1, Infinity],
  ])
    assert.throws(() => drawingPdfGeometry(w, h))
  assert.throws(() => drawingPdfGeometry(100, 100, { paper: 'invalid' }))
  assert.throws(() => vectorFontWeight('invalid'))
  assert.throws(() => vectorFontWeight(650))
})
