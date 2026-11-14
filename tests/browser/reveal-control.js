// Open optional tool groups through their visible disclosure controls.
export async function revealControl(control) {
  const sections = await control.locator('xpath=ancestor::details').all()
  for (const section of sections) {
    if ((await section.getAttribute('open')) === null) await section.locator(':scope > summary').click()
  }
}
