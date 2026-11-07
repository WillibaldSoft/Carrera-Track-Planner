import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { emptyTrackPlan } from '../../vendor/racehubos/shared/src/trackPlan.js'
const output = process.env.PLANNER_EXPORT_VERIFICATION_DIR || path.resolve('test-results/drawing-exports')
const source = {
  ...emptyTrackPlan(),
  showElevationLabels: true,
  pieces: Array.from({ length: 6 }, (_, i) => ({
    type: 'Standardgerade',
    level: 0,
    jointDegrees: 0,
    ...(i === 0
      ? { elevation: { heightMm: 0, flat: false } }
      : i === 3
        ? { elevation: { heightMm: 160, flat: true } }
        : i === 5
          ? { elevation: { heightMm: 0, flat: true } }
          : {}),
    ...(i === 2 ? { heightLabelOffset: { alongMm: 100, acrossMm: -450 } } : {}),
  })),
}
async function open(page, lang = 'de') {
  await page.goto('/')
  await page.getByTestId('standalone-language').selectOption(lang)
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('planner-files-toggle').click()
  await page
    .getByTestId('track-plan-import')
    .setInputFiles({ name: 'export.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) })
  await page.getByTestId('planner-mode').selectOption('editor')
  await page.locator('.planner-name').fill('Manual labels export ' + lang)
  await page.evaluate(() => document.fonts.ready)
}
async function state(page, xml) {
  return page.evaluate((xml) => {
    const root = xml ? new DOMParser().parseFromString(xml, 'image/svg+xml') : document
    const svg = xml ? root.documentElement : document.querySelector('[data-testid="graph-track-canvas"]')
    const group = svg.querySelector('[data-testid="track-height-labels"]')
    return {
      box: svg.getAttribute('viewBox'),
      group: group?.getAttribute('transform') ?? null,
      cards: [...svg.querySelectorAll('[data-testid="track-height-label"]')].map((n) => ({
        rail: n.getAttribute('data-height-rail'),
        position: n.getAttribute('transform'),
        manual: n.getAttribute('data-label-manual'),
        text: n.querySelector('text').textContent.replace(/\s+/g, ' ').trim(),
      })),
      leaders: [...svg.querySelectorAll('[data-testid="height-label-leader"]')].map((n) =>
        ['x1', 'y1', 'x2', 'y2'].map((k) => n.getAttribute(k)),
      ),
    }
  }, xml)
}
async function download(page, id, file) {
  const pending = page.waitForEvent('download')
  const controls = id.startsWith('export-image-')
    ? page.getByTestId('planner-image-export').filter({ has: page.getByTestId('graph-track-canvas') })
    : page
  await controls.getByTestId(id).click()
  const d = await pending
  await fs.mkdir(path.dirname(file), { recursive: true })
  await d.saveAs(file)
  return fs.readFile(file)
}
for (const lang of ['de', 'en', 'fr'])
  test(`manual labels retained in SVG, PNG, PDF and current-view printing (${lang})`, async ({ page }) => {
    await open(page, lang)
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    if (lang === 'fr') {
      const canvas = page.getByTestId('graph-track-canvas'),
        previous = await canvas.getAttribute('viewBox')
      const manual = page.locator('[data-testid="track-height-label"][data-height-rail="2"]')
      await manual.focus()
      await manual.press('Enter')
      await canvas.focus()
      await canvas.press('f')
      await expect(canvas).not.toHaveAttribute('viewBox', previous)
    }
    const dir = path.join(output, 'tmp', 'pdfs', lang),
      before = await state(page)
    expect(before.cards.some((c) => c.manual === 'true')).toBeTruthy()
    const svg = await download(page, 'export-image-svg', path.join(dir, 'view.svg'))
    expect(await state(page, svg.toString())).toEqual(before)
    expect(svg.toString()).toContain('data:font/')
    const png = await download(page, 'export-image-png', path.join(dir, 'view.png'))
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    const pdfFile =
      lang === 'de' ? path.join(output, 'output', 'pdf', 'manual-labels-vector.pdf') : path.join(dir, 'view.pdf')
    const pdf = await download(page, 'export-image-pdf', pdfFile)
    expect(pdf.subarray(0, 8).toString()).toMatch(/^%PDF-1\./)
    expect(pdf.toString('latin1')).not.toMatch(/\/Subtype\s*\/Image/)
    expect(pdf.toString('latin1')).toContain('/FontFile2')
    await page.getByTestId('track-print-preview').click()
    await expect(page.getByTestId('track-print-view')).toHaveValue('current')
    const image = page.getByTestId('track-print-snapshot')
    await image.evaluate((img) => img.decode())
    const src = await image.getAttribute('src'),
      snapshot = await page.evaluate(async (src) => await (await fetch(src)).text(), src)
    expect(await state(page, snapshot)).toEqual(before)
    await page.evaluate(() => {
      window.__printInvoked = false
      window.print = () => {
        window.__printInvoked = true
      }
    })
    await page.getByTestId('track-print-now').click()
    await expect.poll(() => page.evaluate(() => window.__printInvoked)).toBe(true)
    await page.pdf({ path: path.join(dir, 'browser-print.pdf'), printBackground: true, preferCSSPageSize: true })
    await page.emulateMedia({ media: 'screen' })
    const printPdf = await download(page, 'track-print-pdf', path.join(dir, 'preview.pdf'))
    expect(printPdf.subarray(0, 8).toString()).toMatch(/^%PDF-1\./)
    await page.getByTestId('track-print-view').selectOption('assembly')
    await expect(page.getByTestId('track-print-page').locator('svg')).toBeVisible()
    await page.getByTestId('track-print-close').click()
    expect(await state(page)).toEqual(before)
    expect(errors).toEqual([])
  })
test('hidden labels stay hidden in all exported snapshots without deleting saved positions', async ({ page }) => {
  await open(page)
  await page.getByTestId('show-track-elevations').uncheck()
  const dir = path.join(output, 'tmp', 'pdfs', 'hidden'),
    svg = await download(page, 'export-image-svg', path.join(dir, 'view.svg'))
  expect((await state(page, svg.toString())).cards).toHaveLength(0)
  await page.getByTestId('track-print-preview').click()
  const src = await page.getByTestId('track-print-snapshot').getAttribute('src')
  const snapshot = await page.evaluate(async (src) => await (await fetch(src)).text(), src)
  expect((await state(page, snapshot)).cards).toHaveLength(0)
  await page.getByTestId('track-print-close').click()
  await page.getByTestId('show-track-elevations').check()
  await expect(page.locator('[data-testid="track-height-label"][data-height-rail="2"]')).toHaveAttribute(
    'data-label-manual',
    'true',
  )
})

test('curved rails, CU and two fuel rails export as vector artwork', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('start-pit-create').click()
  await page.getByTestId('planner-mode').selectOption('editor')
  const dir = path.join(output, 'tmp', 'pdfs', 'cu-pit')
  await download(page, 'export-image-svg', path.join(dir, 'view.svg'))
  await download(page, 'export-image-png', path.join(dir, 'view.png'))
  const pdf = await download(page, 'export-image-pdf', path.join(dir, 'view.pdf'))
  expect(pdf.toString('latin1')).not.toMatch(/\/Subtype\s*\/Image/)
  expect(pdf.toString('latin1')).toContain('/FontFile2')
  await page.getByTestId('planner-files-toggle').click()
  const curved = {
    ...source,
    pieces: source.pieces.map((p, i) => ({ ...p, type: i % 2 ? 'Kurve_1_60_links' : p.type })),
  }
  await page
    .getByTestId('track-plan-import')
    .setInputFiles({ name: 'curved.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(curved)) })
  await download(page, 'export-image-png', path.join(dir, 'curved.png'))
  await download(page, 'export-image-pdf', path.join(dir, 'curved.pdf'))
})
