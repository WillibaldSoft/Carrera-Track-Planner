import { defineConfig } from '@playwright/test'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3181',
    locale: 'de-DE',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `"${process.execPath}" standalone-server.mjs`,
    cwd: path.resolve(import.meta.dirname, 'addons/track-planner'),
    url: 'http://127.0.0.1:3181',
    reuseExistingServer: false,
    env: { PORT: '3181', RACEHUBOS_PLANNER_DATA_DIR: path.join(os.tmpdir(), 'planner-tests-' + randomUUID()) },
  },
})
