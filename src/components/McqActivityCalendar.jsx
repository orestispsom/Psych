import { useEffect, useMemo, useState } from 'react'
import WrongAnswerPractice from './WrongAnswerPractice.jsx'
import { Icons } from './Icons.jsx'
import {
  athensDayKey, athensMonthKey, shiftMonth, monthDays, activityUtcBounds,
  mergeActivityAttempts, attemptsOnDay, groupActivityByDay, distinctWrongQuestions,
  activityLevel,
} from '../lib/mcqActivity.mjs'

const weekdays = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ']
const monthLabel = key => new Intl.DateTimeFormat('el-GR', {
  timeZone: 'UTC', year: 'numeric', month: 'long',
}).format(new Date(key + '-01T12:00:00Z'))
const dayLabel = key => new Intl.DateTimeFormat('el-GR', {
  timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
}).format(new Date(key + 'T12:00:00Z'))
const modeNames = {
  sprint: 'Mini-test', written: 'Προσομοίωση 100',
  random: 'Τυχαία θέματα', category: 'Ανά κατηγορία',
  weakness: 'Αδύναμα θέματα', bookmarks: 'Σημειωμένες',
  daily: 'Ημερήσια πρόκληση', DSM5: 'DSM-5',
  vignettes: 'Κλινικά σενάρια', matching: 'Αντιστοίχιση',
}
export function dayModeCounts(attempts) {
  const counts = {}
  for (const item of attempts) {
    const mode = item.mode || 'unknown'
    counts[mode] = (counts[mode] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

function useMonthActivity({ profileId, month, progress, loadRemote }) {
  const [remote, setRemote] = useState([])
  const [status, setStatus] = useState(loadRemote ? 'loading' : 'local')
  useEffect(() => {
    let cancelled = false
    setRemote([])
    if (!loadRemote || !profileId) {
      setStatus('local')
      return undefined
    }
    setStatus('loading')
    loadRemote(profileId, activityUtcBounds(month)).then(rows => {
      if (cancelled) return
      setRemote(rows || [])
      setStatus('ready')
    }).catch(() => {
      if (!cancelled) {
        setRemote([])
        setStatus('error')
      }
    })
    return () => { cancelled = true }
  }, [profileId, month, loadRemote])
  const attempts = useMemo(() => mergeActivityAttempts(
    progress?.attempts || [], remote, progress?.resetAt,
  ), [progress?.attempts, progress?.resetAt, remote])
  return { attempts, status }
}

export function McqActivityCalendar({ profileId, progress, loadRemote, onOpenDay }) {
  const [month, setMonth] = useState(() => athensMonthKey())
  const { attempts, status } = useMonthActivity({ profileId, month, progress, loadRemote })
  const days = useMemo(() => monthDays(month), [month])
  const summary = useMemo(() => groupActivityByDay(attempts, month), [attempts, month])
  const today = athensDayKey(new Date())
  const currentMonth = today.slice(0, 7)
  const monthTotal = Object.values(summary).reduce((acc, value) => acc + value.total, 0)
  return <section className="home-calendar" aria-label="Ημερολόγιο MCQ">
    <div className="subscale"><h2 className="subscale-title">Ημερολόγιο MCQ</h2><span className="subscale-rule" /></div>
    <div className="activity-calendar">
      <div className="activity-calendar-head">
        <button type="button" className="activity-nav" aria-label="Προηγούμενος μήνας" onClick={() => setMonth(m => shiftMonth(m,-1))}><Icons.ChevronLeft /></button>
        <h3 aria-live="polite">{monthLabel(month)}</h3>
        <button type="button" className="activity-nav" aria-label="Επόμενος μήνας" disabled={month >= currentMonth} onClick={() => setMonth(m => shiftMonth(m,1))}><Icons.ChevronRight /></button>
        <span className="activity-total">{monthTotal} απαντήσεις</span>
      </div>
      <div className="activity-days">
        {weekdays.map(name => <span className="activity-weekday" key={name}>{name}</span>)}
        {days.map((key, index) => {
          if (!key) return <span className="activity-blank" key={'blank-'+index} aria-hidden="true"/>
          const count = summary[key]?.total || 0
          return <button type="button" key={key} onClick={() => onOpenDay(key)}
            className={`activity-day activity-level-${activityLevel(count)}${key === today ? ' activity-today' : ''}`}
            aria-label={`${dayLabel(key)}: ${count} απαντήσεις`}>
            <span className="activity-day-number">{Number(key.slice(-2))}</span>
            <span className="activity-day-count">{count ? count + ' MCQ' : '·'}</span>
          </button>
        })}
      </div>
      <div className="activity-calendar-foot">
        <span>Ζώνη ώρας: Ελλάδα (Αθήνα)</span>
        <span>{status === 'loading' ? 'Φόρτωση ιστορικού…' : status === 'error' ? 'Μερικά δεδομένα: αποτυχία συγχρονισμού' : status === 'local' ? 'Διαθέσιμο τοπικό ιστορικό' : 'Ενημερωμένο ιστορικό'}</span>
      </div>
    </div>
  </section>
}

export function McqActivityDay({ date, profileId, progress, loadRemote, getQuestion, onRecordAnswer, onBack }) {
  const [reviewing, setReviewing] = useState(false)
  const { attempts, status } = useMonthActivity({ profileId, month: date.slice(0, 7), progress, loadRemote })
  const daily = useMemo(() => attemptsOnDay(attempts, date), [attempts, date])
  const wrong = useMemo(() => distinctWrongQuestions(daily, getQuestion), [daily, getQuestion])
  const correctCount = daily.filter(a => a.isCorrect).length
  const wrongCount = daily.length - correctCount
  const modes = useMemo(() => dayModeCounts(daily), [daily])

  return <div className="activity-results">
    {reviewing ? <WrongAnswerPractice
      key={date}
      questions={wrong}
      title={dayLabel(date)}
      isActive
      onBack={() => setReviewing(false)}
      backLabel="Επιστροφή στα αποτελέσματα ημέρας"
      onAnswer={(question, selection, meta) => onRecordAnswer(question, selection, meta)}
    /> : <>
      <button type="button" className="back-link" onClick={onBack}><Icons.ChevronLeft /> Αρχική</button>
      <div className="sheet-head"><div className="sheet-head-text">
        <span className="sheet-eyebrow">Αποτελέσματα ημέρας · ώρα Ελλάδας</span>
        <h2>{dayLabel(date)}</h2>
      </div></div>
      {status === 'loading' ? <p role="status">Φόρτωση ιστορικού απαντήσεων…</p> : <>
        {status !== 'ready' && <p className="activity-coverage-note" role="status">
          {status === 'error' ? 'Δεν φορτώθηκε το διαδικτυακό ιστορικό. Τα σύνολα μπορεί να είναι ελλιπή.' : 'Προβάλλεται μόνο το διαθέσιμο τοπικό ιστορικό.'}
        </p>}
        <div className="activity-stats">
          <div><strong>{daily.length}</strong><span>Απαντήσεις MCQ</span></div>
          <div><strong>{correctCount}</strong><span>Σωστές</span></div>
          <div><strong>{wrongCount}</strong><span>Λάθος</span></div>
        </div>
        <h3 className="activity-subtitle">Ανά τύπο εξέτασης</h3>
        {modes.length
          ? <div className="activity-mode-list">{modes.map(([mode, count]) => <div key={mode}><span>{modeNames[mode] || mode}</span><strong>{count}</strong></div>)}</div>
          : <p className="muted">Δεν υπάρχουν καταγεγραμμένες απαντήσεις για αυτή την ημέρα.</p>}
        <button type="button" className="btn btn-primary activity-review-button"
          disabled={!wrong.length} onClick={() => setReviewing(true)}>
          Επανάληψη λαθών ({wrong.length})
        </button>
        {wrongCount > wrong.length && <p className="muted activity-footnote">
          Τα ίδια ερωτήματα εμφανίζονται μία φορά στην επανάληψη.
          {wrongCount > 0 && wrong.length === 0 ? ' Δεν υπάρχουν διαθέσιμα ερωτήματα στην τρέχουσα τράπεζα.' : ''}
        </p>}
      </>}
    </>}
  </div>
}
