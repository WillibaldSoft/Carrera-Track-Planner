import { test, expect } from '@playwright/test'
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
  const rail = canvas.getByTestId('rail-2')
  await rail.focus()
  await rail.press('Enter')
  await page.getByTestId('free-part-angle').fill('180')
  await page.getByTestId('free-part-angle').press('Tab')
  await expect(cu.locator('text').filter({ hasText: /^CONTROL UNIT$/ })).toHaveAttribute(
    'transform',
    'rotate(180 172 -107)',
  )
  await page.getByTestId('track-undo').click()
  await expect(cu.locator('text').filter({ hasText: /^CONTROL UNIT$/ })).toHaveAttribute(
    'transform',
    'rotate(0 172 -107)',
  )
  expect(await page.locator('form').evaluate((f) => f.checkValidity())).toBe(true)
})
