import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { PLANNER_VERSION } from './version'
const Context = createContext(null)
const repository = 'https://api.github.com/repos/WillibaldSoft/Carrera-Track-Planner/releases/latest'
const releases = 'https://github.com/WillibaldSoft/Carrera-Track-Planner/releases'
export function notesForLanguage(body, language) {
  const labels = { de: 'Deutsch', en: 'English', fr: 'Français' },
    label = labels[language?.slice(0, 2)] ?? labels.en
  const blocks = String(body ?? '').split(/^## (Deutsch|English|Français)\s*$/m)
  const index = blocks.indexOf(label)
  return index >= 0 ? blocks[index + 1].trim() : String(body ?? '')
}
export function publicRelease(release, current) {
  const version = release?.tag_name?.replace(/^v/, '')
  if (release?.draft || release?.prerelease || !/^\d+\.\d+\.\d+$/.test(version ?? '')) throw Error('invalidRelease')
  const x = version.split('.').map(Number),
    y = current.split('.').map(Number)
  let available = false
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) {
      available = x[i] > y[i]
      break
    }
  }
  const prefix = `${releases}/download/${release.tag_name}/`
  const names = [
    'track-planner.racehub-addon.json',
    'RaceHubOS-Streckenplaner-Linux-x64.tar.gz',
    'RaceHubOS-Streckenplaner-Windows-x64.zip',
    `racehubos-track-planner_${version}_amd64.deb`,
  ]
  const downloads = (release.assets ?? [])
    .filter((a) => names.includes(a.name) && a.state === 'uploaded' && a.browser_download_url === prefix + a.name)
    .map((a) => ({ name: a.name, url: a.browser_download_url }))
  return { version, available, notes: release.body ?? '', url: `${releases}/tag/${release.tag_name}`, downloads }
}
export function PlannerUpdateProvider({ children }) {
  const standalone = window.parent === window
  const updateApi = standalone ? '/api/updates' : '/api/addons/track-planner/updates'
  const preference = `carrera-updates-at-start-${standalone ? 'standalone' : 'addon'}`
  const [auto, setAuto] = useState(() => {
    try {
      return localStorage.getItem(preference) === 'true'
    } catch {
      return false
    }
  })
  const [info, setInfo] = useState({ current: PLANNER_VERSION, canInstall: false }),
    [release, setRelease] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false)
  const alive = useRef(true)
  async function json(url, options) {
    let response
    try {
      response = await fetch(url, options)
    } catch {
      throw Error('network')
    }
    let result
    try {
      result = await response.json()
    } catch {
      throw Error('network')
    }
    if (!response.ok || result.success === false)
      throw Error(result.error ?? (response.status === 403 || response.status === 429 ? 'rateLimit' : 'network'))
    return result
  }
  async function readInfo() {
    let result
    try {
      result = await json(updateApi + '/info')
    } catch (e) {
      if (standalone) throw e
      result = { current: PLANNER_VERSION, canInstall: false, reason: 'hostUpdateUnavailable' }
    }
    if (alive.current) setInfo(result)
    return result
  }
  async function check() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const capability = await readInfo()
      const result =
        standalone || capability?.hostManaged
          ? await json(updateApi + '/check')
          : publicRelease(
              await json(repository, {
                headers: { Accept: 'application/vnd.github+json' },
                signal: AbortSignal.timeout(45000),
              }),
              PLANNER_VERSION,
            )
      if (alive.current) setRelease(result)
      return result
    } catch (e) {
      if (alive.current) setError(e.message)
    } finally {
      if (alive.current) setBusy(false)
    }
  }
  useEffect(() => {
    alive.current = true
    readInfo().catch(() => {})
    if (auto) check()
    return () => {
      alive.current = false
    }
  }, [])
  function automatic(value) {
    setAuto(value)
    try {
      localStorage.setItem(preference, String(value))
    } catch {
      setError('preference')
    }
  }
  async function install(bundleText, selectedRelease = release) {
    if (busy || dirty || !info.canInstall || !selectedRelease?.available || !selectedRelease.installable) return
    setBusy(true)
    setError('')
    try {
      const latestInfo = await readInfo()
      await json(updateApi + '/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: selectedRelease.version,
          confirmationToken: latestInfo.token,
          ...(typeof bundleText === 'string' ? { bundleText } : {}),
        }),
      })
      const deadline = Date.now() + (standalone ? 240000 : 600000)
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        let next
        try {
          next = await readInfo()
        } catch {
          continue
        }
        const phase = next?.state?.phase
        if (phase === 'complete') {
          window.location.reload()
          return
        }
        if (['failed', 'rolledBack', 'interrupted'].includes(phase)) throw Error(next.state.error ?? 'installFailed')
      }
      throw Error('restartTimeout')
    } catch (e) {
      if (alive.current) setError(e.message)
    } finally {
      if (alive.current) setBusy(false)
    }
  }
  async function installFile(file) {
    if (!file || busy || dirty || !standalone) return
    setError('')
    try {
      if (file.size > 32000000) throw Error('integrity')
      const text = await file.text()
      let bundle
      try {
        bundle = JSON.parse(text)
      } catch {
        throw Error('invalidBundle')
      }
      if (bundle?.kind !== 'carrera-planner.update' || bundle.format !== 1) throw Error('invalidBundle')
      const candidate = await check()
      if (!candidate) return
      if (!candidate.available) throw Error('alreadyCurrent')
      if (bundle.version !== candidate.version) throw Error('changed')
      await install(text, candidate)
    } catch (e) {
      if (alive.current) setError(e.message)
    }
  }
  return (
    <Context.Provider
      value={{ standalone, auto, automatic, info, release, busy, error, dirty, setDirty, check, install, installFile }}
    >
      {children}
    </Context.Provider>
  )
}
export const usePlannerUpdates = () => useContext(Context)
