import { revealControl } from './reveal-control.js'
import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import { emptyTrackPlan } from '../../vendor/racehubos/shared/src/index.js'
const next = {
  success: true,
  available: true,
  installable: true,
  version: '1.2.1',
  notes: '## Deutsch\nVerbesserte Updates.\n## English\nImproved updates.\n## Français\nMises à jour améliorées.',
  url: 'https://github.com/WillibaldSoft/Carrera-Track-Planner/releases/tag/v1.2.1',
  downloads: [],
}
async function openUpdates(page) {
  const trigger = page.getByTestId('planner-updates-toggle')
  await revealControl(trigger)
  await trigger.click()
}
async function setup(page) {
  let checks = 0,
    installs = 0
  await page.route('**/api/updates/info', (route) =>
    route.fulfill({
      json: {
        success: true,
        current: '1.2.0',
        canInstall: true,
        platform: 'linux',
        token: 'test-confirmation-token',
        state: { phase: 'idle' },
      },
    }),
  )
  await page.route('**/api/updates/check', (route) => {
    checks++
    return route.fulfill({ json: next })
  })
  await page.route('**/api/updates/install', (route) => {
    installs++
    expect(route.request().postDataJSON()).toEqual({ version: '1.2.1', confirmationToken: 'test-confirmation-token' })
    return route.fulfill({ status: 409, json: { success: false, error: 'integrity' } })
  })
  await page.goto('/')
  return { checks: () => checks, installs: () => installs }
}
for (const lang of ['de', 'en', 'fr'])
  test(`optional startup checks and explicit checksum-verified installation (${lang})`, async ({ page }) => {
    const requests = await setup(page),
      errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.getByTestId('standalone-language').selectOption(lang)
    await openUpdates(page)
    await expect(page.getByTestId('updates-at-start')).not.toBeChecked()
    expect(requests.checks()).toBe(0)
    expect(requests.installs()).toBe(0)
    await page.getByTestId('updates-check').click()
    await expect(page.getByTestId('updates-available')).toBeVisible()
    expect(requests.installs()).toBe(0)
    await page.getByTestId('updates-available').locator('summary').click()
    await expect(page.locator('.planner-update-notes')).toContainText(
      { de: 'Verbesserte', en: 'Improved', fr: 'améliorées' }[lang],
    )
    const dir = `docs/screenshots/updates/${lang}`
    await fs.mkdir(dir, { recursive: true })
    await page.screenshot({ path: `${dir}/01-optional-check-and-release.png` })
    await page.getByTestId('updates-at-start').check()
    await page.reload()
    await expect.poll(() => requests.checks()).toBe(2)
    expect(requests.installs()).toBe(0)
    await openUpdates(page)
    await expect(page.getByTestId('updates-at-start')).toBeChecked()
    await page.getByTestId('updates-install').click()
    await expect(page.getByTestId('updates-error')).toBeVisible()
    expect(requests.installs()).toBe(1)
    await page.screenshot({ path: `${dir}/02-checksum-failure-blocked.png` })
    await page.keyboard.press('Escape')
    await page.getByTestId('standalone-new').click()
    await page.getByTestId('room-continue').click()
    await page.getByTestId('add-track-piece').click()
    await page.locator('.planner-name').fill('Unsaved update demo')
    await openUpdates(page)
    await expect(page.getByTestId('updates-install')).toBeDisabled()
    await expect(page.getByTestId('updates-dirty')).toBeVisible()
    await page.screenshot({ path: `${dir}/03-unsaved-changes-protected.png` })
    expect(requests.installs()).toBe(1)
    expect(errors).toEqual([])
  })
test('offline checks leave the planner usable and startup remains opt-in', async ({ page }) => {
  await setup(page)
  await page.route('**/api/updates/check', (route) =>
    route.fulfill({ status: 502, json: { success: false, error: 'network' } }),
  )
  await openUpdates(page)
  await page.getByTestId('updates-check').click()
  await expect(page.getByTestId('updates-error')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByTestId('standalone-new').click()
  await page.getByTestId('room-continue').click()
  await page.getByTestId('add-track-piece').click()
  await expect(page.getByTestId('graph-track-canvas')).toHaveAttribute('data-piece-count', '1')
})
test('Debian system installs offer the matching package without a direct install button', async ({ page }) => {
  await setup(page)
  await page.route('**/api/updates/info', (route) =>
    route.fulfill({
      json: {
        success: true,
        current: '1.2.0',
        canInstall: false,
        reason: 'systemPackage',
        platform: 'linux',
        state: { phase: 'idle' },
      },
    }),
  )
  await page.route('**/api/updates/check', (route) =>
    route.fulfill({
      json: {
        ...next,
        downloads: [
          {
            name: 'racehubos-track-planner_1.2.1_amd64.deb',
            url: 'https://github.com/WillibaldSoft/Carrera-Track-Planner/releases/download/v1.2.1/racehubos-track-planner_1.2.1_amd64.deb',
          },
        ],
      },
    }),
  )
  await page.reload()
  await openUpdates(page)
  await page.getByTestId('updates-check').click()
  await expect(page.getByTestId('updates-install')).toHaveCount(0)
  await expect(page.getByTestId('updates-download')).toHaveAttribute('href', /amd64\.deb$/)
})

for (const lang of ['de', 'en', 'fr'])
  test(`add-on uses the host update path without local installation (${lang})`, async ({ page, baseURL }) => {
    let checks = 0,
      localCalls = 0
    const prefix = 'https://github.com/WillibaldSoft/Carrera-Track-Planner/releases/download/v1.2.1/'
    await page.route('https://api.github.com/repos/WillibaldSoft/Carrera-Track-Planner/releases/latest', (route) => {
      checks++
      return route.fulfill({
        json: {
          tag_name: 'v1.2.1',
          draft: false,
          prerelease: false,
          body: next.notes,
          assets: [
            {
              name: 'track-planner.racehub-addon.json',
              state: 'uploaded',
              browser_download_url: prefix + 'track-planner.racehub-addon.json',
            },
          ],
        },
      })
    })
    await page.route('**/api/updates/**', (route) => {
      localCalls++
      return route.fulfill({ status: 404, json: { success: false } })
    })
    const draft = { name: 'Host update demo', plan: emptyTrackPlan() }
    await page.route('**/updates-host.html', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<iframe style="width:1400px;height:900px" src="${baseURL}/#host=${encodeURIComponent(baseURL)}"></iframe><script>addEventListener('message',e=>{if(e.data?.type==='ready')e.source.postMessage({channel:'racehubos:track-planner:1',type:'init',language:'${lang}',dark:false,draft:${JSON.stringify(draft)}},'${baseURL}')})</script>`,
      }),
    )
    await page.setViewportSize({ width: 1440, height: 950 })
    await page.goto('/updates-host.html')
    const frame = page.frameLocator('iframe')
    await revealControl(frame.getByTestId('planner-updates-toggle'))
    await expect(frame.getByTestId('planner-updates-toggle')).toBeVisible()
    expect(checks).toBe(0)
    await frame.getByTestId('planner-updates-toggle').click()
    await expect(frame.getByTestId('updates-at-start')).not.toBeChecked()
    await frame.getByTestId('updates-check').click()
    await expect(frame.getByTestId('updates-download')).toHaveAttribute(
      'href',
      prefix + 'track-planner.racehub-addon.json',
    )
    await expect(frame.getByTestId('updates-install')).toHaveCount(0)
    expect(localCalls).toBe(0)
    expect(checks).toBe(1)
    await fs.mkdir(`docs/screenshots/updates/${lang}`, { recursive: true })
    await page.screenshot({ path: `docs/screenshots/updates/${lang}/04-addon-host-installation.png` })
  })
test('update controls remain reachable on narrow screens and Escape returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 720 })
  await setup(page)
  await page.getByTestId('standalone-language').selectOption('fr')
  const trigger = page.getByTestId('planner-updates-toggle')
  await trigger.click()
  await page.getByTestId('updates-check').click()
  await expect(page.getByTestId('updates-available')).toBeVisible()
  const popup = page.getByRole('dialog', { name: 'Mises à jour' }),
    box = await popup.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(641)
  expect(box.y + box.height).toBeLessThanOrEqual(721)
  await page.keyboard.press('Escape')
  await expect(popup).not.toBeVisible()
  await expect(trigger).toBeFocused()
})
