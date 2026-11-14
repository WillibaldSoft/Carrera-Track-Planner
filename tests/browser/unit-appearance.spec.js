import { test, expect } from '@playwright/test'
import { emptyTrackPlan, enableFreePlacement, transformFreeParts } from '../../vendor/racehubos/shared/src/index.js'

async function assertLeftOfSlot(canvas) {
  const offsets = await canvas.evaluate((svg) => {
    const result = []
    for (const group of svg.querySelectorAll(
      '[data-testid^="cu-track-sensor-"], [data-testid="fuel-infrared-sensor"], [data-testid="switch-infrared-sensor"], [data-testid="pit-switch-infrared-sensor"]',
    )) {
      const circle = group.querySelector('circle')
      const lane =
        group.dataset.slotY !== undefined
          ? Number(group.dataset.slotY)
          : group.dataset.testid.startsWith('cu-track-sensor-')
            ? group.dataset.testid.endsWith('-0')
              ? -49.5
              : 49.5
            : 0
      const x = circle.cx.baseVal.value,
        y = circle.cy.baseVal.value,
        matrix = group.getScreenCTM()
      const centre = new DOMPoint(x, lane).matrixTransform(matrix)
      const diode = new DOMPoint(x, y).matrixTransform(matrix)
      const forward = new DOMPoint(x + 1, lane).matrixTransform(matrix)
      const dx = forward.x - centre.x,
        dy = forward.y - centre.y
      result.push((dx * (diode.y - centre.y) - dy * (diode.x - centre.x)) / (dx * dx + dy * dy))
    }
    return result
  })
  expect(offsets.length).toBeGreaterThan(0)
  for (const offset of offsets) expect(offset).toBeLessThan(-5)
  for (const label of await canvas.locator('[data-fuel-artwork] text').all())
    await expect(label).toHaveAttribute('y', '-29')
}

test('CU and fuel artwork stays readable when rotated and keeps slots and two fuel assignments', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('start-pit-create').click()
  const canvas = page.getByTestId('graph-track-canvas'),
    cu = canvas.locator('[data-unit-kind="Control_unit"]')
  await expect(cu.getByTestId('cu-start-finish-markings')).toHaveCount(1)
  await expect(cu.locator('[data-testid^="cu-indicator-"]')).toHaveCount(5)
  await expect(cu.locator('[data-testid^="cu-button-"]')).toHaveCount(5)
  await expect(cu.locator('text').filter({ hasText: /^CONTROL UNIT$/ })).toHaveAttribute(
    'transform',
    'rotate(0 172 -107)',
  )
  await expect(canvas.locator('[data-fuel-artwork="striped-sensor"]')).toHaveCount(2)
  await expect(canvas.locator('[data-rail-slots="pit-native"]')).not.toHaveCount(0)
  await assertLeftOfSlot(canvas)
  await expect(canvas.getByTestId('pit-switch-infrared-sensor')).toHaveCount(2)
  const fuel = canvas.locator('[data-part-article="30361"]').first()
  await fuel.focus()
  await fuel.press('Enter')
  await page.getByTestId('pit-part-headingDegrees').fill('180')
  await page.getByTestId('pit-part-headingDegrees').press('Tab')
  await assertLeftOfSlot(canvas)
  await page.getByTestId('track-undo').click()
  const rail = canvas.getByTestId('rail-2')
  await rail.focus()
  await rail.press('Enter')
  await page.getByTestId('free-part-angle').fill('180')
  await page.getByTestId('free-part-angle').press('Tab')
  await expect(cu.locator('text').filter({ hasText: /^CONTROL UNIT$/ })).toHaveAttribute(
    'transform',
    'rotate(180 172 -107)',
  )
  await assertLeftOfSlot(canvas)
  await page.getByTestId('track-undo').click()
  await expect(cu.locator('text').filter({ hasText: /^CONTROL UNIT$/ })).toHaveAttribute(
    'transform',
    'rotate(0 172 -107)',
  )
  expect(await page.locator('form').evaluate((f) => f.checkValidity())).toBe(true)
})

test('incoming straight, double and curved switch diodes remain left at reversed headings; exit modules stay passive', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('planner-nav-files').click()
  const types = [
    'DigitaleDoppelweiche_1',
    'DigitaleDoppelweiche_2',
    'Weiche_links_1',
    'Weiche_rechts_1',
    ...['links', 'rechts'].flatMap((side) => ['ai', 'ia'].map((route) => `Kurvenweiche_${side}_${route}_1`)),
    'Kurvenweiche_links_ai_2',
    'Pit_stop_weiche_anfang',
    'Pit_stop_weiche_ende',
  ]
  let plan = enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: types.map((type) => ({ type, level: 0, jointDegrees: 0 })),
  })
  plan = transformFreeParts(
    plan,
    types.map((_, i) => i),
    { degrees: 180, dx: 0, dy: 0 },
  )
  await page.getByTestId('track-plan-import').setInputFiles({
    name: 'switch-diodes.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(plan)),
  })
  await page.getByTestId('planner-nav-editor').click()
  const canvas = page.getByTestId('graph-track-canvas')
  await expect(canvas.getByTestId('switch-infrared-sensor')).toHaveCount(8)
  await expect(canvas.getByTestId('pit-switch-infrared-sensor')).toHaveCount(1)
  await expect(canvas.getByTestId('rail-1').getByTestId('switch-infrared-sensor')).toHaveCount(0)
  await expect(canvas.getByTestId('rail-8').getByTestId('switch-infrared-sensor')).toHaveCount(0)
  await expect(canvas.locator('[data-pit-fixed-merge] circle')).toHaveCount(0)
  await assertLeftOfSlot(canvas)
  await page.getByTestId('planner-nav-3d').click()
  await expect(page.getByTestId('room-3d-canvas').getByTestId('switch-infrared-sensor')).toHaveCount(8)
})
