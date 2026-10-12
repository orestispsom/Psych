import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadCurriculum } from '../content/loader'
import {
  indexContent,
  type Curriculum,
  type RuntimeChunk,
} from '../content/types'
import { createSearchIndex, type SearchResult } from '../content/search'
import type {
  LearningSnapshot,
  ReviewRating,
  StudySettings,
  UIRecord,
} from '../learning/types'
import {
  snapshot,
  saveUI,
  saveSettings,
  openChunk,
  startToday,
  startPractice,
  completeStudy,
  revealAnswer,
  rateAnswer,
  reconcileSession,
} from '../db/operations'
import type { PsychFlashDatabase } from '../db/database'
import { Brand, LanguageToggle, NavItems } from '../components/Primitives'
import { useI18n } from '../i18n'
import { LibraryScreen } from '../features/library/LibraryScreen'
import { ProgressScreen } from '../features/progress/ProgressScreen'
import { StudyScreen } from '../features/study/StudyScreen'
import { RecallScreen } from '../features/review/RecallScreen'
import { SearchDialog } from '../features/search/SearchDialog'
import { SettingsDialog } from '../features/settings/SettingsDialog'
import { OfflineStatus } from '../components/OfflineStatus'
import { journal } from '../cloud/sync'
import { createPath, movePath, restartPath, type PathStrategy, type StudyPath } from '../learning/paths'
import { savePath, removePath } from '../db/operations'
import { PathsScreen, pathLabel } from '../features/paths/PathsScreen'

export default function StudyApp({
  db,
  onMutation,
  syncRevision = 0,
}: {
  db: PsychFlashDatabase
  onMutation?: () => void
  syncRevision?: number
}) {
  const [data, setData] = useState<Curriculum>(),
    [state, setState] = useState<LearningSnapshot>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [searchOpen, setSearch] = useState(false),
    [settingsOpen, setSettings] = useState(false)
  const { t, locale } = useI18n()

  const locked = useRef(false),
    focus = useRef<HTMLElement>(null)
  const refresh = useCallback(async () => {
    setState(await snapshot(db))
  }, [db])
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      if (locked.current) return
      locked.current = true
      setBusy(true)
      setError('')
      try {
        await journal(action, db)
        await refresh()
        onMutation?.()
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'Could not save progress. Retry before continuing.',
        )
      } finally {
        locked.current = false
        setBusy(false)
      }
    },
    [refresh, onMutation, db],
  )
  const loadingGeneration = useRef(0)
  async function initialize() {
    const generation = ++loadingGeneration.current
    setError('')
    try {
      const [curriculum, saved] = await Promise.all([
        loadCurriculum(locale),
        snapshot(db),
      ])
      if (generation !== loadingGeneration.current) return
      for (const session of saved.sessions)
        if (session.cursor < session.items.length)
          await db.sessions.put(reconcileSession(session, curriculum))
      setData(curriculum)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the app.')
    }
  }
  useEffect(() => {
    void initialize()
    return () => { loadingGeneration.current++ }
  }, [locale, db])
  useEffect(() => {
    void refresh()
  }, [syncRevision, refresh])
  useEffect(() => {
    const channel = new BroadcastChannel('psych-study-progress-' + db.name)
    channel.onmessage = () =>
      void refresh().catch(() =>
        setError('Could not refresh progress from another tab.'),
      )
    const visible = () => {
      if (document.visibilityState === 'visible')
        void refresh().catch(() =>
          setError('Could not refresh local progress.'),
        )
    }
    document.addEventListener('visibilitychange', visible)
    const interval = setInterval(visible, 60000)
    return () => {
      channel.close()
      document.removeEventListener('visibilitychange', visible)
      clearInterval(interval)
    }
  }, [refresh])
  useEffect(() => {
    if (state) {
      const c = new BroadcastChannel('psych-study-progress-' + db.name)
      c.postMessage('changed')
      c.close()
    }
  }, [state?.logs.length, state?.chunks.length])
  const index = useMemo(() => (data ? indexContent(data) : undefined), [data]),
    searchIndex = useMemo(() => (data ? createSearchIndex(data) : []), [data])
  const ui = state?.ui,
    session = state?.sessions.find((s) => s.id === ui?.activeSessionId),
    item = session?.items[session.cursor],
    activePath = state?.paths.find(p => p.id === ui?.activePathId),
    pathChunk = activePath && index?.chunks.get(activePath.sequence[activePath.cursor]),
    pathSession = state?.sessions.find(s => s.id === activePath?.questionSessionId),
    pathItem = pathSession?.items[pathSession.cursor],
    pathQuestion = pathItem?.kind === 'review'
      ? index?.questions.get(pathItem.questionId)?.question : undefined,
    pathVisible = Boolean(ui?.tab === 'today' && ui?.pathScreen === 'active' && activePath && pathChunk)
  const chunk = index?.chunks.get(ui?.activeChunkId ?? item?.chunkId ?? ''),
    question =
      item?.kind === 'review'
        ? index?.questions.get(item.questionId)?.question
        : undefined
  const updateUI = (patch: Partial<UIRecord>) =>
    run(async () => {
      await saveUI({ ...state!.ui, ...patch }, db)
    })
  const open = (c: RuntimeChunk) =>
    run(async () => {
      await openChunk(c, db)
      await saveUI({
        ...state!.ui,
        mode: 'study',
        activeChunkId: c.id,
        reviewTopic: false,
      }, db)
    })
  const back = () =>
    updateUI({
      mode: ui?.reviewTopic ? 'review' : 'shell',
      reviewTopic: false,
      activeChunkId: ui?.reviewTopic ? item?.chunkId : ui?.activeChunkId,
    })
  const reveal = () => run(() => revealAnswer(session!.id, session!.cursor, db))
  const rate = (r: ReviewRating) =>
    run(() => rateAnswer(session!.id, session!.cursor, r, db))
  const test = () =>
    run(async () => {
      if (session && item?.kind === 'study' && item.chunkId === chunk!.id)
        await completeStudy(session.id, session.cursor, db)
      else await startPractice(chunk!, undefined, db)
    })
  // Navigation belongs to each path; learner records remain shared.
  const storePath = (path: StudyPath, patch: Partial<UIRecord> = {}) =>
    run(async () => {
      await savePath(path, db)
      if (path.cursor !== activePath?.cursor) {
        const next = index?.chunks.get(path.sequence[path.cursor])
        if (next) await openChunk(next, db)
      }
      await saveUI({ ...state!.ui, ...patch }, db)
    })
  const studyHome = () => updateUI({ tab: 'today', mode: 'shell', pathScreen: 'home', reviewTopic: false })
  const usePath = (path: StudyPath) => run(async () => {
    const next = index?.chunks.get(path.sequence[path.cursor])
    if (next) await openChunk(next, db)
    await saveUI({ ...state!.ui, tab: 'today', mode: 'shell',
      pathScreen: 'active', activePathId: path.id, reviewTopic: false }, db)
  })
  const newPath = (strategy: PathStrategy) => run(async () => {
    const existing = state!.paths.filter(p => p.strategy === strategy).length
    const label = pathLabel(strategy, locale)
    const path = createPath(data!, strategy, existing ? label + ' ' + (existing + 1) : label,
      state!.chunks, state!.questions, state!.logs)
    await savePath(path, db)
    const first = index?.chunks.get(path.sequence[0])
    if (first) await openChunk(first, db)
    await saveUI({
      ...state!.ui, tab: 'today', mode: 'shell',
      pathScreen: 'active', activePathId: path.id, reviewTopic: false,
    }, db)
  })
  const renamePath = (path: StudyPath) => {
    const name = window.prompt(locale === 'el' ? 'Όνομα διαδρομής' : 'Path name', path.name)?.trim()
    if (name && name !== path.name && name.length <= 100)
      storePath({ ...path, name, updatedAt: new Date().toISOString() })
  }
  const resetPath = (path: StudyPath) => {
    if (window.confirm(locale === 'el'
      ? 'Επανεκκίνηση διαδρομής; Η κοινή πρόοδος μελέτης δεν διαγράφεται.'
      : 'Restart this path? Shared learning progress will be preserved.'))
      storePath(restartPath(path))
  }
  const deletePath = (path: StudyPath) => {
    if (!window.confirm(locale === 'el'
      ? 'Διαγραφή διαδρομής; Η κοινή πρόοδος μελέτης δεν διαγράφεται.'
      : 'Delete this path? Shared learning progress will be preserved.')) return
    run(async () => {
      await removePath(path.id, db)
      if (ui!.activePathId === path.id)
        await saveUI({ ...ui!, activePathId: undefined, pathScreen: 'home', mode: 'shell' }, db)
    })
  }
  const pathMove = (direction: -1 | 1) => {
    if (!activePath) return
    storePath(movePath(activePath, direction), { mode: 'shell', reviewTopic: false })
  }
  const pathRead = () => {
    if (activePath) storePath({ ...activePath, stage: 'read', updatedAt: new Date().toISOString() },
      { mode: 'shell', reviewTopic: false })
  }
  const pathTest = () => {
    if (!activePath || !pathChunk) return
    run(async () => {
      const existing = state!.sessions.find(s => s.id === activePath.questionSessionId)
      const review = existing && existing.cursor < existing.items.length &&
        existing.items[existing.cursor]?.chunkId === pathChunk.id
        ? existing : await startPractice(pathChunk, undefined, db)
      await savePath({
        ...activePath, stage: 'recall', questionSessionId: review.id,
        visited: [...new Set([...activePath.visited, pathChunk.id])],
        updatedAt: new Date().toISOString(),
      }, db)
      await saveUI({ ...state!.ui, mode: 'shell', tab: 'today', pathScreen: 'active',
        reviewTopic: false, activeSessionId: review.id }, db)
    })
  }
  const pathRate = (rating: ReviewRating) => {
    if (!activePath || !pathSession) return
    run(async () => {
      await rateAnswer(pathSession.id, pathSession.cursor, rating, db)
      if (pathSession.cursor + 1 >= pathSession.items.length)
        await savePath({ ...activePath, stage: 'read', questionSessionId: undefined,
          updatedAt: new Date().toISOString() }, db)
      await saveUI({ ...state!.ui, mode: 'shell', tab: 'today', pathScreen: 'active',
        reviewTopic: false }, db)
    })
  }
  const start = () => run(() => startToday(data!, db))
  const save = (s: StudySettings) =>
    run(async () => {
      await saveSettings(s, db)
      setSettings(false)
    })
  function select(r: SearchResult) {
    setSearch(false)
    if (r.question) void run(async () => {
      await startPractice(r.chunk, r.question!.id, db)
      const current = await db.ui.get('current')
      await saveUI({ ...current!, tab: 'library' }, db)
    })
    else void run(async () => {
      await openChunk(r.chunk, db)
      await saveUI({ ...state!.ui, mode: 'study', tab: 'library',
        activeChunkId: r.chunk.id, reviewTopic: false }, db)
    })
  }
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyK' || e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        if (!settingsOpen) setSearch((s) => !s)
        return
      }
      if (
        searchOpen ||
        settingsOpen ||
        busy ||
        !state ||
        state.settings.keyboardShortcuts === false ||
        ui?.mode !== 'review' ||
        !session ||
        !question
      )
        return
      if (
        (e.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable="true"],button,a',
        )
      )
        return
      if (!session.revealed && [' ', 'Enter'].includes(e.key)) {
        e.preventDefault()
        void reveal()
      }
      if (session.revealed && /^[1-4]$/.test(e.key)) {
        e.preventDefault()
        void rate(
          (['again', 'hard', 'good', 'easy'] as const)[Number(e.key) - 1],
        )
      }
    }
    const openSearch = () => setSearch(true)
    window.addEventListener('psych-study-open-search', openSearch)
    window.addEventListener('keydown', handle)
    return () => {
      window.removeEventListener('keydown', handle)
      window.removeEventListener('psych-study-open-search', openSearch)
    }
  })
  useEffect(() => {
    focus.current?.focus()
    if (!pathVisible) window.scrollTo(0, 0)
  }, [ui?.mode, ui?.tab, ui?.activeChunkId, session?.cursor, pathVisible])
  // Reading position is device-local; path sequence and question progress sync across devices.
  useEffect(() => {
    if (!pathVisible || !pathChunk || !activePath ||
        activePath.stage !== 'read' || ui?.reviewTopic) return
    const key = ['psych-study-scroll', db.name, activePath.id, pathChunk.id].join(':')
    const saved = Number(window.localStorage.getItem(key) || 0)
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, Number.isFinite(saved) ? Math.max(0, saved) : 0))
    const capture = () => {
      try { window.localStorage.setItem(key, String(Math.round(window.scrollY))) } catch {}
    }
    window.addEventListener('scroll', capture, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      capture()
      window.removeEventListener('scroll', capture)
    }
  }, [db.name, pathVisible, activePath?.id, activePath?.cursor, activePath?.stage, pathChunk?.id, ui?.reviewTopic])
  if (!data || !state || !index)
    return (
      <main className="page">
        <div className="setup-toolbar">
          <Brand />
          <LanguageToggle />
        </div>
        <h1>Μελέτη</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button
              className="primary-button"
              onClick={() => void initialize()}
            >
              {t('retry')}
            </button>
          </>
        ) : (
          <p role="status">{t('loading')}</p>
        )}
      </main>
    )
  const shell =
    !pathVisible && (ui!.mode === 'shell' ||
    !chunk ||
    (ui!.mode === 'review' && (!session || !question)))
  return (
    <div className={shell ? 'app-shell' : 'focus-shell'} lang={locale}>
      <a className="skip-link" href="#main">
        {t('skip')}
      </a>
      {shell && (
        <aside className="sidebar">
          <Brand />
          <nav aria-label="Πλοήγηση μελέτης">
            <NavItems
              active={ui!.tab}
              onChange={(tab) =>
                void updateUI({ tab, mode: 'shell', reviewTopic: false })
              }
            />
          </nav>
          <div className="sidebar-utilities">
            <LanguageToggle />
            <button
              className="utility-button"
              onClick={() => setSettings(true)}
            >
              {t('settings')}
            </button>
          </div>
        </aside>
      )}
      <main id="main" ref={focus} tabIndex={-1} aria-busy={busy}>
        <OfflineStatus busy={busy} />
        <div className="global-tools">
          <LanguageToggle compact />
          <button className="utility-button" onClick={() => setSearch(true)}>
            {t('search')} <kbd>Ctrl/⌘ K</kbd>
          </button>
          <button className="utility-button" onClick={() => setSettings(true)}>
            {t('settings')}
          </button>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button
              className="utility-button"
              onClick={() => void run(refresh)}
            >
              {t('refresh')}
            </button>
          </div>
        )}
        <fieldset className="interaction-surface" disabled={busy}>
          {pathVisible ? (
            activePath!.stage === 'recall' && pathSession && pathQuestion && !ui!.reviewTopic ? (
              <RecallScreen
                chunk={pathChunk!}
                question={pathQuestion}
                session={pathSession}
                onReveal={() => void run(() => revealAnswer(pathSession.id, pathSession.cursor, db))}
                onRate={pathRate}
                onTopic={() => void updateUI({ reviewTopic: true })}
                onBack={pathRead}
                onHome={studyHome}
              />
            ) : (
              <StudyScreen
                chunk={pathChunk!}
                revisit={Boolean(ui!.reviewTopic)}
                onBack={ui!.reviewTopic ? () => void updateUI({ reviewTopic: false }) : () => pathMove(-1)}
                onTest={pathTest}
                onHome={studyHome}
                onPrevious={ui!.reviewTopic ? undefined : () => pathMove(-1)}
                onNext={ui!.reviewTopic || activePath!.cursor >= activePath!.sequence.length - 1
                  ? undefined : () => pathMove(1)}
                position={(activePath!.cursor + 1) + ' / ' + activePath!.sequence.length}
              />
            )
          ) : shell ? (
            ui!.tab === 'today' ? (
              <PathsScreen
                paths={state.paths}
                choosing={ui!.pathScreen === 'choose' || !state.paths.length}
                onNew={() => void updateUI({ pathScreen: ui!.pathScreen === 'choose' ? 'home' : 'choose', mode: 'shell' })}
                onCreate={newPath}
                onSelect={usePath}
                onRename={renamePath}
                onRestart={resetPath}
                onDelete={deletePath}
              />
            ) : ui!.tab === 'library' ? (
              <LibraryScreen
                index={index}
                state={state}
                onOpen={(c) => void open(c)}
                onToggle={(id) =>
                  void updateUI({
                    expandedDomains: ui!.expandedDomains.includes(id)
                      ? ui!.expandedDomains.filter((d) => d !== id)
                      : [...ui!.expandedDomains, id],
                  })
                }
              />
            ) : (
              <ProgressScreen index={index} state={state} />
            )
          ) : ui!.mode === 'study' ? (
            <StudyScreen
              chunk={chunk!}
              revisit={ui!.reviewTopic}
              onBack={() => void back()}
              onTest={() => void test()}
            />
          ) : (
            <RecallScreen
              chunk={chunk!}
              question={question!}
              session={session!}
              onReveal={() => void reveal()}
              onRate={(r) => void rate(r)}
              onTopic={() =>
                void updateUI({
                  mode: 'study',
                  reviewTopic: true,
                  activeChunkId: item!.chunkId,
                })
              }
              onBack={() =>
                void updateUI({ mode: 'shell', reviewTopic: false })
              }
            />
          )}
        </fieldset>
      </main>
      {shell && (
        <nav className="bottom-nav" aria-label="Πλοήγηση μελέτης στο κινητό">
          <NavItems
            active={ui!.tab}
            onChange={(tab) =>
              void updateUI({ tab, mode: 'shell', reviewTopic: false })
            }
          />
        </nav>
      )}
      {searchOpen && (
        <SearchDialog
          index={searchIndex}
          onClose={() => setSearch(false)}
          onSelect={select}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          settings={state.settings}
          onSave={save}
          onClose={() => setSettings(false)}
        />
      )}
    </div>
  )
}
