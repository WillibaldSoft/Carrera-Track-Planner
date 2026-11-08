import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
execFileSync(
  process.execPath,
  [
    path.join(root, 'node_modules/vite/bin/vite.js'),
    'build',
    '--config',
    path.join(root, 'addons/track-planner/vite.config.mjs'),
  ],
  { cwd: root, stdio: 'inherit' },
)
const dist = path.join(root, 'addons/track-planner/dist')
const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
await fs.writeFile(
  path.join(dist, 'release.json'),
  JSON.stringify({ application: 'carrera-track-planner', version }) + '\n',
)
for (const name of ['LICENSE', 'NOTICE']) await fs.copyFile(path.join(root, name), path.join(dist, name))
await fs.mkdir(path.join(dist, 'LICENSES'), { recursive: true })
await fs.copyFile(path.join(root, 'LICENSES/Apache-2.0.txt'), path.join(dist, 'LICENSES/Apache-2.0.txt'))
await fs.mkdir(path.join(dist, 'update-guides'), { recursive: true })
for (const language of ['de', 'en', 'fr'])
  await fs.copyFile(path.join(root, `docs/UPDATES.${language}.md`), path.join(dist, `update-guides/${language}.txt`))
const manifest = {
  id: 'track-planner',
  hostApi: 1,
  license: 'AGPL-3.0-only',
  source: `https://github.com/WillibaldSoft/Carrera-Track-Planner/tree/v${version}`,
  version,
  entry: 'index.html',
  files: {},
}
const files = {}
async function collect(folder) {
  for (const item of await fs.readdir(folder, { withFileTypes: true })) {
    const target = path.join(folder, item.name)
    if (item.isDirectory()) await collect(target)
    else if (item.isFile()) {
      const name = path.relative(dist, target).split(path.sep).join('/'),
        data = await fs.readFile(target)
      manifest.files[name] = createHash('sha256').update(data).digest('hex')
      files[name] = data.toString('base64')
    }
  }
}
await collect(dist)
const output = path.join(root, 'addons/track-planner/track-planner.racehub-addon.json')
await fs.writeFile(output, JSON.stringify({ manifest, files }))
console.log(output)

await import('./build-update-bundle.mjs')
