import { createHash } from 'node:crypto'
export const REPOSITORY = 'WillibaldSoft/Carrera-Track-Planner'
export const RELEASE_URL = `https://github.com/${REPOSITORY}/releases`
export const UPDATE_ASSET = 'Carrera-Track-Planner-update.json'
export const sha256 = (data) => createHash('sha256').update(data).digest('hex')
export class UpdateError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}
export function compareVersions(a, b) {
  const parse = (v) => {
    if (!/^\d+\.\d+\.\d+$/.test(v)) throw new UpdateError('invalidRelease')
    return v.split('.').map(Number)
  }
  const x = parse(a),
    y = parse(b)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return Math.sign(x[i] - y[i])
  return 0
}
export function releaseSummary(release, current) {
  const version = release?.tag_name?.replace(/^v/, '')
  if (!release || release.draft || release.prerelease || !/^\d+\.\d+\.\d+$/.test(version ?? ''))
    throw new UpdateError('invalidRelease')
  const asset = (release.assets ?? []).find((a) => a.name === UPDATE_ASSET)
  const checksum = (release.assets ?? []).find((a) => a.name === 'SHA256SUMS')
  const downloadPrefix = `https://github.com/${REPOSITORY}/releases/download/${release.tag_name}/`
  const valid = (a) => a && a.state === 'uploaded' && a.browser_download_url === downloadPrefix + a.name
  const names = [
    'track-planner.racehub-addon.json',
    'RaceHubOS-Streckenplaner-Linux-x64.tar.gz',
    'RaceHubOS-Streckenplaner-Windows-x64.zip',
    `racehubos-track-planner_${version}_amd64.deb`,
  ]
  const downloads = (release.assets ?? [])
    .filter((a) => names.includes(a.name) && valid(a))
    .map((a) => ({ name: a.name, url: a.browser_download_url }))
  return {
    downloads,
    version,
    available: compareVersions(version, current) > 0,
    notes: typeof release.body === 'string' ? release.body.slice(0, 30000) : '',
    url: `${RELEASE_URL}/tag/${release.tag_name}`,
    installable: !!(
      valid(asset) &&
      valid(checksum) &&
      /^sha256:[a-f0-9]{64}$/.test(asset.digest ?? '') &&
      asset.size > 0 &&
      asset.size <= 32000000
    ),
    asset: valid(asset) ? asset : null,
    checksum: valid(checksum) ? checksum : null,
  }
}
export async function fetchBytes(url, { fetchImpl = fetch, limit = 32000000 } = {}) {
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Carrera-Track-Planner-Updater' },
    signal: AbortSignal.timeout(45000),
    redirect: 'follow',
  })
  if (!response.ok) throw new UpdateError(response.status === 403 || response.status === 429 ? 'rateLimit' : 'network')
  if (Number(response.headers.get('content-length')) > limit) throw new UpdateError('integrity')
  const chunks = []
  let size = 0
  if (!response.body) throw new UpdateError('network')
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > limit) {
      await response.body.cancel?.().catch(() => {})
      throw new UpdateError('integrity')
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
export async function latestRelease(current, options = {}) {
  let data
  try {
    data = JSON.parse(
      (
        await fetchBytes(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, { ...options, limit: 1000000 })
      ).toString('utf8'),
    )
  } catch (e) {
    if (e instanceof UpdateError) throw e
    throw new UpdateError('network')
  }
  return releaseSummary(data, current)
}
export async function verifiedDownload(summary, options = {}) {
  if (!summary.installable) throw new UpdateError('manualOnly')
  const sums = (await fetchBytes(summary.checksum.browser_download_url, { ...options, limit: 200000 })).toString('utf8')
  const rows = sums
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => /^([a-f0-9]{64})\s+\*?([^\r\n]+)$/.exec(line))
  const matching = rows.filter((row) => row?.[2] === UPDATE_ASSET)
  if (matching.length !== 1 || summary.asset.digest !== `sha256:${matching[0][1]}`) throw new UpdateError('integrity')
  const bytes = options.bundleBytes ?? (await fetchBytes(summary.asset.browser_download_url, options))
  if (!Buffer.isBuffer(bytes) || bytes.length > 32000000) throw new UpdateError('integrity')
  if (bytes.length !== summary.asset.size || sha256(bytes) !== matching[0][1]) throw new UpdateError('integrity')
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch {
    throw new UpdateError('integrity')
  }
}
