// A self-contained HTTP planner fixture: npm test must also work before a Vite
// build. Published application bundles are separately validated at packaging.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from '../../addons/track-planner/updater/release.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export async function makeUpdateBundle(version = '1.2.0') {
  const result = { kind: 'carrera-planner.update', format: 1, version, minimumNode: '22.13.0', files: {} }
  const set = (name, data) => {
    result.files[name] = { data: Buffer.from(data).toString('base64'), sha256: sha256(data) }
  }
  set('dist/index.html', '<!doctype html><title>Isolated planner update fixture</title>')
  set('dist/release.json', JSON.stringify({ application: 'carrera-track-planner', version }))
  for (const name of [
    'launcher.mjs',
    'standalone-server.mjs',
    ...['engine', 'release', 'service', 'restart'].map((n) => 'updater/' + n + '.mjs'),
  ])
    set(name, await fs.readFile(path.join(root, 'addons/track-planner', name)))
  for (const name of ['LICENSE', 'NOTICE']) set(name, await fs.readFile(path.join(root, name)))
  set('README.md', 'Isolated planner fixture, never a production installation.')
  set('SOURCE.txt', 'AGPL-3.0-only\nhttps://github.com/WillibaldSoft/Carrera-Track-Planner\n')
  return result
}
