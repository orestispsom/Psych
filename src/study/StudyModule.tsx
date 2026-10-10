import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import StudyApp from './app/StudyApp'
import { PsychFlashDatabase } from './db/database'
import { ProfileSync } from './cloud/sync'
import { cloudEnabled } from './cloud/config'
import { I18nProvider, type Locale } from './i18n'
import { defaultUI } from './learning/types'
import './study.css'

// One controller per existing Psych profile, even if the section is reopened
// while an upload is still running. Each controller owns its own database.
const controllers = new Map<string, ProfileSync>()
const ensuredProfiles = new Set<string>()
export function studyController(profileId: string) {
  let controller = controllers.get(profileId)
  if (!controller) {
    const db = new PsychFlashDatabase(`psych-study-v1-${profileId}`)
    controller = new ProfileSync(profileId, db, () => {
      window.dispatchEvent(new CustomEvent('psych-study-synced', { detail: profileId }))
    })
    controllers.set(profileId, controller)
  }
  return controller
}

type PsychProfile = { id: string; name: string }
export default function StudyModule({ profile, ensureProfile }: {
  profile: PsychProfile
  ensureProfile?: (profile: PsychProfile, signal?: AbortSignal) => Promise<unknown>
}) {
  const controller = useMemo(() => studyController(profile.id), [profile.id])
  const profileRef = useRef(profile)
  profileRef.current = profile
  const ensure = useCallback(async () => {
    if (!ensuredProfiles.has(profile.id) && ensureProfile) {
      // Reuse the host's idempotent metadata helper for profiles created offline.
      await ensureProfile(profileRef.current, AbortSignal.timeout(15000))
      ensuredProfiles.add(profile.id)
    }
  }, [profile.id, ensureProfile])
  const [ready, setReady] = useState(false)
  const [locale, setLocale] = useState<Locale>('el')
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState('Φόρτωση αποθηκευμένης προόδου…')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const sync = useCallback(async () => {
    if (!cloudEnabled) {
      setStatus('Αποθήκευση στη συσκευή')
      return
    }
    setStatus('Συγχρονισμός…')
    try {
      await ensure()
      await controller.sync()
      const savedLocale = (await controller.db.settings.get('locale'))?.value
      setLocale(savedLocale === 'en' ? 'en' : 'el')
      const queued = await controller.db.outbox.count()
      setStatus(queued ? `${queued} αλλαγές περιμένουν συγχρονισμό` : 'Συγχρονίστηκε')
      setError('')
    } catch {
      setStatus('Αποθηκεύτηκε στη συσκευή · αναμονή σύνδεσης')
      setError('Δεν ολοκληρώθηκε ο συγχρονισμός. Η τοπική πρόοδος παραμένει αποθηκευμένη. Δοκίμασε ξανά με σύνδεση.')
    }
  }, [controller, ensure])

  useEffect(() => {
    let active = true
    setReady(false)
    void (async () => {
      try {
        await controller.db.open()
        const cached = Boolean(await controller.db.syncMeta.get('cursor'))
          || (await controller.db.chunkProgress.count()) > 0
          || (await controller.db.sessions.count()) > 0
          || (await controller.db.outbox.count()) > 0
        let synced = false
        if (cloudEnabled && !cached) {
          try { await ensure(); await controller.sync(); synced = true }
          catch {
            if (active) {
              setStatus('Απαιτείται σύνδεση για την πρώτη φόρτωση')
              setError('Για την πρώτη φόρτωση της μελέτης αυτού του προφίλ απαιτείται σύνδεση. Δοκίμασε ξανά όταν συνδεθείς.')
            }
            return
          }
        }
        if (!active) return
        const savedLocale = (await controller.db.settings.get('locale'))?.value
        setLocale(savedLocale === 'en' ? 'en' : 'el')
        const ui = (await controller.db.ui.get('current')) ?? defaultUI
        await controller.db.ui.put({ ...ui, tab: 'today', mode: 'shell', reviewTopic: false })
        if (!active) return
        setReady(true)
        const pending = await controller.db.outbox.count()
        setStatus(!cloudEnabled ? 'Αποθήκευση στη συσκευή' : pending ? `${pending} αλλαγές περιμένουν συγχρονισμό` : synced ? 'Συγχρονίστηκε' : 'Συγχρονισμός…')
        if (cached && cloudEnabled) void sync()
      } catch {
        if (active) setError('Δεν άνοιξε η αποθήκευση της μελέτης. Έλεγξε ότι η αποθήκευση του προγράμματος περιήγησης είναι διαθέσιμη και δοκίμασε ξανά.')
      }
    })()
    const updated = (event: Event) => {
      if ((event as CustomEvent).detail === profile.id && active) setRevision(value => value + 1)
    }
    const retry = () => { if (active && document.visibilityState === 'visible') void sync() }
    const preferenceChanged = (event: Event) => {
      if ((event as CustomEvent).detail === controller.db.name) retry()
    }
    window.addEventListener('psych-study-synced', updated)
    window.addEventListener('psych-study-sync-request', preferenceChanged)
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', retry)
    const timer = setInterval(retry, 30000)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('psych-study-synced', updated)
      window.removeEventListener('psych-study-sync-request', preferenceChanged)
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', retry)
      // Do not close an old profile's DB during its in-flight local write or
      // upload. Progress is never reassigned to the next selected profile.
    }
  }, [controller, profile.id, sync, attempt, ensure])

  return <section className="study-module" aria-label="Μελέτη">
    <link rel="manifest" href="/study/manifest.webmanifest" />
    <header className="study-sync-header">
      <span>Πρόοδος: {profile.name}</span>
      <span role="status">{status}</span>
      {cloudEnabled && <button type="button" onClick={() => void sync()}>Συγχρονισμός</button>}
    </header>
    {error && <div className="study-sync-error" role="alert">{error} <button type="button" onClick={() => ready ? void sync() : setAttempt(value => value + 1)}>Δοκίμασε ξανά</button></div>}
    {ready ? <I18nProvider db={controller.db} initialLocale={locale}>
      <StudyApp db={controller.db} onMutation={() => void sync()} syncRevision={revision} />
    </I18nProvider> : <p role="status">{error ? 'Η μελέτη δεν φορτώθηκε.' : 'Φόρτωση μελέτης…'}</p>}
  </section>
}
