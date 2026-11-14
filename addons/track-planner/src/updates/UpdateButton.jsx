import { useRef } from 'react'
import { Popover } from 'radix-ui'
import { Download, X, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@core/components/ui/button'
import { usePlannerUpdates, notesForLanguage } from './UpdateContext'
export default function UpdateButton() {
  const fileInput = useRef(null)
  const update = usePlannerUpdates(),
    { t, i18n } = useTranslation('plannerUpdates')
  if (!update) return null
  const { standalone, auto, automatic, info, release, busy, error, dirty, check, install, installFile } = update
  const manualName = !standalone
    ? 'track-planner.racehub-addon.json'
    : info.reason === 'systemPackage'
      ? `racehubos-track-planner_${release?.version}_amd64.deb`
      : info.platform === 'win32'
        ? 'RaceHubOS-Streckenplaner-Windows-x64.zip'
        : info.platform === 'linux'
          ? 'RaceHubOS-Streckenplaner-Linux-x64.tar.gz'
          : null
  const direct =
    info.canInstall &&
    release?.installable &&
    !['incompatible', 'manualOnly', 'unsupportedInstallation'].includes(error)
  const manual = release?.downloads?.find((a) => a.name === manualName)
  const phase = info.state?.phase
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button type="button" variant="outline" data-testid="planner-updates-toggle">
          <Download size={16} />
          {release?.available ? t('availableShort', { version: release.version }) : t('title')}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="planner-layer-popover planner-update-panel"
          sideOffset={8}
          align="end"
          collisionPadding={12}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={t('title')}
        >
          <div className="planner-layer-heading">
            <strong>{t('title')}</strong>
            <Popover.Close asChild>
              <button type="button" aria-label={t('close')}>
                <X size={18} />
              </button>
            </Popover.Close>
          </div>
          <p>{t('current', { version: info.current })}</p>
          <label className="planner-update-start">
            <input
              type="checkbox"
              data-testid="updates-at-start"
              checked={auto}
              onChange={(e) => automatic(e.target.checked)}
            />
            {t('atStart')}
          </label>
          <p>{t('optional')}</p>
          <Button type="button" variant="outline" data-testid="updates-check" disabled={busy} onClick={check}>
            <RefreshCw size={15} />
            {busy ? t('working') : t('check')}
          </Button>
          {standalone && info.canInstall && (
            <div>
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                hidden
                data-testid="updates-file-input"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) installFile(file)
                }}
              />
              <Button
                type="button"
                variant="outline"
                data-testid="updates-install-file"
                disabled={busy || dirty}
                onClick={() => fileInput.current?.click()}
              >
                {t('installFile')}
              </Button>
              <p>{t('fileHelp')}</p>
              {dirty && <p role="note">{t('dirty')}</p>}
            </div>
          )}
          {error && (
            <p role="alert" data-testid="updates-error">
              {t(`errors.${error}`, { defaultValue: t('errors.generic') })}
            </p>
          )}
          {release && !release.available && (
            <p role="status" data-testid="updates-current">
              {t('upToDate')}
            </p>
          )}
          {release?.available && (
            <section data-testid="updates-available">
              <h3>{t('available', { version: release.version })}</h3>
              <details>
                <summary>{t('changes')}</summary>
                <pre className="planner-update-notes">{notesForLanguage(release.notes, i18n.resolvedLanguage)}</pre>
              </details>
              {direct ? (
                <>
                  <p>{t(standalone ? 'installHelp' : 'addonInstallHelp')}</p>
                  {dirty && (
                    <p role="note" data-testid="updates-dirty">
                      {t('dirty')}
                    </p>
                  )}
                  <Button
                    type="button"
                    data-testid="updates-install"
                    disabled={busy || dirty}
                    onClick={() => install()}
                  >
                    {t(standalone ? 'install' : 'installAddon')}
                  </Button>
                </>
              ) : (
                <>
                  <p>{t(!standalone ? 'addonHelp' : info.reason === 'systemPackage' ? 'systemHelp' : 'manualHelp')}</p>
                  {manual && (
                    <a
                      className="underline"
                      data-testid="updates-download"
                      href={manual.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('download')}
                    </a>
                  )}
                </>
              )}
              <p>
                <a className="underline" href={release.url} target="_blank" rel="noreferrer">
                  {t('releasePage')}
                </a>
              </p>
            </section>
          )}
          {phase && phase !== 'idle' && (
            <p role="status" data-testid="updates-phase">
              {t(`phases.${phase}`, { defaultValue: t('working') })}
            </p>
          )}
          <p>
            <a
              className="underline"
              href={`./update-guides/${(i18n.resolvedLanguage ?? 'en').slice(0, 2)}.txt`}
              target="_blank"
              rel="noreferrer"
            >
              {t('guide')}
            </a>
          </p>
          {info.state?.backup && (
            <p className="planner-update-backup">
              {t('backup')}: <code>{info.state.backup}</code>
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
