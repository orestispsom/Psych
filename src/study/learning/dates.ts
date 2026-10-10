export function localDay(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}
export function validExamDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const [y, m, d] = value.split('-').map(Number),
    parsed = new Date(Date.UTC(y, m - 1, d))
  return y >= 2020 && y <= 2200 && parsed.toISOString().slice(0, 10) === value
}
export function daysToExam(exam: string, now = new Date()): number {
  if (!validExamDate(exam)) throw new Error('Enter a valid examination date.')
  const [y, m, d] = exam.split('-').map(Number)
  return Math.round(
    (Date.UTC(y, m - 1, d) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      86400000,
  )
}
