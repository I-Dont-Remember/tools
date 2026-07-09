import type { DateStr } from './types'

// Date helpers operating on 'YYYY-MM-DD' strings. UTC-only to avoid TZ drift.

export function parse(d: DateStr): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}

export function format(date: Date): DateStr {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(d: DateStr, n: number): DateStr {
  const date = parse(d)
  date.setUTCDate(date.getUTCDate() + n)
  return format(date)
}

export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((parse(a).getTime() - parse(b).getTime()) / 86_400_000)
}

export function cmp(a: DateStr, b: DateStr): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function month(d: DateStr): string {
  return d.slice(0, 7) // 'YYYY-MM'
}

export function lastDayOfMonth(d: DateStr): DateStr {
  const date = parse(d)
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
  return format(last)
}

export function max(a: DateStr, b: DateStr): DateStr {
  return cmp(a, b) >= 0 ? a : b
}

export function min(a: DateStr, b: DateStr): DateStr {
  return cmp(a, b) <= 0 ? a : b
}
