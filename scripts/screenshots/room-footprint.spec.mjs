import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
for (const lang of ['de', 'en', 'fr'])
  test(`room footprint screenshots (${lang})`, async ({ page }) => {
    const output = path.resolve('docs/screenshots/room-planner', lang)
    await fs.mkdir(output, { recursive: true })
    const shots = []
    async function shot(id) {
      const file = id + '.png'
      const data = await page.screenshot({ path: path.join(output, file), fullPage: true })
      shots.push({ id, file, sha256: createHash('sha256').update(data).digest('hex') })
    }
    await page.goto('/')
    await page.getByTestId('standalone-language').selectOption(lang)
    await page.getByTestId('standalone-new').click()
    await page
      .locator('.planner-name')
      .fill(
        {
          de: 'Demoraum mit Kamin und Fensternische',
          en: 'Demo room with chimney and window alcove',
          fr: 'Pièce de démonstration avec cheminée et renfoncement',
        }[lang],
      )
    await page
      .getByTestId('room-template-name')
      .fill({ de: 'Wohnzimmer · Demo', en: 'Living room · Demo', fr: 'Séjour · Démonstration' }[lang])
    await shot('01-room-first')
    await page.getByTestId('room-add-obstacle').click()
    await page.getByTestId('room-feature-name').fill({ de: 'Kamin', en: 'Chimney', fr: 'Cheminée' }[lang])
    await page.getByTestId('room-feature-widthM').fill('0.8')
    await page.getByTestId('room-feature-depthM').fill('0.6')
    await page.getByTestId('room-add-extension').click()
    await page
      .getByTestId('room-feature-name')
      .fill({ de: 'Fensternische', en: 'Window alcove', fr: 'Renfoncement de fenêtre' }[lang])
    await page.getByTestId('room-feature-depthM').fill('1.8')
    await page.getByTestId('room-feature-yM').fill('1.2')
    await shot('02-room-shape-elements')
    await page.getByTestId('room-continue').click()
    await page.getByTestId('start-pit-create').click()
    await expect(page.getByTestId('track-room-background')).toBeVisible()
    await shot('03-room-background-track')
    await page.getByTestId('planner-mode').selectOption('room')
    await page
      .getByTestId('room-template-select')
      .selectOption({
        label: { de: 'Wohnzimmer · Demo', en: 'Living room · Demo', fr: 'Séjour · Démonstration' }[lang],
      })
    await shot('04-reuse-room')
    await fs.writeFile(
      path.join(output, 'manifest.json'),
      JSON.stringify(
        { language: lang, syntheticData: true, viewport: { width: 1600, height: 1400 }, screenshots: shots },
        null,
        2,
      ) + '\n',
    )
  })
