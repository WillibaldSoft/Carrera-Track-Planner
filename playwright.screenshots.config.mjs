import base from './playwright.config.mjs'
export default {
  ...base,
  testDir: './scripts/screenshots',
  webServer: { ...base.webServer, url: 'http://127.0.0.1:3182', env: { ...base.webServer.env, PORT: '3182' } },
  testMatch: '*.spec.mjs',
  timeout: 180000,
  outputDir: './test-results/screenshots',
  use: {
    ...base.use,
    baseURL: 'http://127.0.0.1:3182',
    viewport: { width: 1600, height: 1400 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  },
}
