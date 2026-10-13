// Calendar reporting uses the explicit Greek IANA time zone, never device time.
// These are answer *attempts*, not unique questions; repeated attempts count.
export const ATHENS_TIME_ZONE = 'Europe/Athens'
const athensParts = new Intl.DateTimeFormat('en-US', {
  timeZone: ATHENS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
})

export function athensDayKey(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  if (Number.isNaN(date.getTime())) return null
  const p = Object.fromEntries(athensParts.formatToParts(date).map(part => [part.type, part.value]))
  return `${p.year}-${p.month}-${p.day}`
}

export const athensMonthKey = (timestamp = new Date()) => athensDayKey(timestamp)?.slice(0, 7)
export function isValidCalendarDay(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return false
  const date = new Date(key + 'T12:00:00Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key
}
export function shiftMonth(monthKey, diff) {
  if (!/^\d{4}-\d{2}$/.test(monthKey || '')) return null
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + diff, 1)).toISOString().slice(0, 7)
}
export function monthDays(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Array.from({ length: Math.ceil((firstWeekday + days) / 7) * 7 }, (_, i) => {
    const day = i - firstWeekday + 1
    return day >= 1 && day <= days ? `${monthKey}-${String(day).padStart(2, '0')}` : null
  })
}
export function activityUtcBounds(monthOrDay) {
  // Broad UTC bounds intentionally overlap Greece's DST transitions; after
  // fetching we select the date by its actual Athens calendar day.
  const isDay = isValidCalendarDay(monthOrDay)
  const first = isDay ? monthOrDay : monthOrDay + '-01'
  const [year, month, day] = first.split('-').map(Number)
  const beginning = Date.UTC(year, month - 1, day || 1)
  const end = isDay ? beginning + 86400000 : Date.UTC(year, month, 1)
  return {
    start: new Date(beginning - 86400000).toISOString(),
    end: new Date(end + 86400000).toISOString(),
  }
}
export function mergeActivityAttempts(local = [], remote = [], resetAt = null) {
  const out = new Map()
  const resetMs = resetAt ? Date.parse(resetAt) : NaN
  for (const record of [...remote, ...local]) {
    const time = Date.parse(record?.attemptedAt)
    if (!Number.isFinite(time) || (Number.isFinite(resetMs) && time <= resetMs)) continue
    const id = record.id || [record.questionId, record.attemptedAt, record.sessionId].join(':')
    if (!out.has(String(id))) out.set(String(id), record)
  }
  return [...out.values()].sort((a,b) => Date.parse(b.attemptedAt) - Date.parse(a.attemptedAt))
}
export function attemptsOnDay(attempts, key) {
  return attempts.filter(attempt => athensDayKey(attempt.attemptedAt) === key)
}
export function groupActivityByDay(attempts, monthKey) {
  const counts = {}
  for (const item of attempts) {
    const key = athensDayKey(item.attemptedAt)
    if (!key || key.slice(0,7) !== monthKey) continue
    const day = counts[key] || { total: 0, correct: 0, wrong: 0 }
    day.total++
    if (item.isCorrect) day.correct++; else day.wrong++
    counts[key] = day
  }
  return counts
}
export function distinctWrongQuestions(attempts, findQuestion) {
  const ids = new Set()
  return attempts.filter(a => {
    const id = String(a.questionId)
    if (a.isCorrect || ids.has(id) || !findQuestion(a.questionId)) return false
    ids.add(id)
    return true
  }).map(a => findQuestion(a.questionId))
}
export function activityLevel(count) {
  if (!count) return 0
  if (count < 10) return 1
  if (count < 25) return 2
  if (count < 50) return 3
  return 4
}
