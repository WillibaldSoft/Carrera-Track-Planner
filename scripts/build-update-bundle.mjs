import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const app = path.join(root, 'addons/track-planner')
const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
const bundle = { kind: 'carrera-planner.update', format: 1, version, minimumNode: '22.13.0', files: {} }
async function file(name, source) {
  const bytes = await fs.readFile(source)
  bundle.files[name] = { data: bytes.toString('base64'), sha256: createHash('sha256').update(bytes).digest('hex') }
}
async function tree(prefix, dir) {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const name = prefix + '/' + item.name,
      p = path.join(dir, item.name)
    if (item.isDirectory()) await tree(name, p)
    else if (item.isFile()) await file(name, p)
    else throw Error('Update payload must contain regular files')
  }
}
await tree('dist', path.join(app, 'dist'))
await tree('updater', path.join(app, 'updater'))
await tree('LICENSES', path.join(root, 'LICENSES'))
for (const name of ['launcher.mjs', 'standalone-server.mjs', 'README.md']) await file(name, path.join(app, name))
for (const name of ['LICENSE', 'NOTICE']) await file(name, path.join(root, name))
await file('THIRD-PARTY-NOTICES.txt', path.join(app, 'dist/THIRD-PARTY-NOTICES.txt'))
const source = Buffer.from(
  `AGPL-3.0-only\nCorresponding Source: https://github.com/WillibaldSoft/Carrera-Track-Planner/archive/refs/tags/v${version}.tar.gz\nBuild: npm ci; npm run build\nSee NOTICE for retained upstream and third-party licenses.\n`,
)
bundle.files['SOURCE.txt'] = {
  data: source.toString('base64'),
  sha256: createHash('sha256').update(source).digest('hex'),
}
await fs.writeFile(path.join(app, 'Carrera-Track-Planner-update.json'), JSON.stringify(bundle))
