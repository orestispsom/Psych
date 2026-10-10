import { useEffect, useState } from 'react'
export function OfflineStatus({ busy }: { busy: boolean }) {
  const [waiting, setWaiting] = useState<ServiceWorker>(),
    [ready, setReady] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine),
    [failed, setFailed] = useState(false)
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine)
    window.addEventListener('online', online)
    window.addEventListener('offline', online)
    let cancelled = false,
      registration: ServiceWorkerRegistration | undefined
    if ('serviceWorker' in navigator && import.meta.env.PROD)
      void navigator.serviceWorker
        .register('/study-sw.js', { scope: '/study', updateViaCache: 'none' })
        .then((r) => {
          registration = r
          if (r.waiting && !cancelled) setWaiting(r.waiting)
          r.addEventListener('updatefound', () => {
            r.installing?.addEventListener('statechange', () => {
              if (r.waiting && navigator.serviceWorker.controller && !cancelled)
                setWaiting(r.waiting)
            })
          })
          return navigator.serviceWorker.ready
        })
        .then(() => {
          if (!cancelled) setReady(true)
        })
        .catch(() => {
          if (!cancelled) setFailed(true)
        })
    const visible = () => {
      if (document.visibilityState === 'visible')
        void registration?.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      cancelled = true
      window.removeEventListener('online', online)
      window.removeEventListener('offline', online)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])
  function update() {
    if (busy) return
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => window.location.reload(),
      { once: true },
    )
    waiting?.postMessage({ type: 'SKIP_WAITING' })
  }
  return (
    <div className="offline-status" role="status">
      {offline
        ? 'Εκτός σύνδεσης · η πρόοδος αποθηκεύεται στη συσκευή'
        : ready
          ? 'Διαθέσιμη μελέτη εκτός σύνδεσης'
          : failed
            ? 'Δεν ολοκληρώθηκε η αποθήκευση για χρήση εκτός σύνδεσης. Δοκίμασε ξανά με σύνδεση.'
            : ''}
      {waiting && (
        <button className="utility-button" disabled={busy} onClick={update}>
          Νέα έκδοση · ασφαλής επαναφόρτωση
        </button>
      )}
    </div>
  )
}
