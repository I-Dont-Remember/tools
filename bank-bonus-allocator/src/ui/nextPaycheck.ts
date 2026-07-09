import type { ForecastResult } from '../model/allocator'
import type { Account, DateStr } from '../model/types'
import { fmtDollars } from '../money'

export interface NextPaycheckSplit {
  date: DateStr
  totalCents: number
  freeCents: number
  perAccount: { id: string; name: string; cents: number }[]
}

export function nextPaycheckSplit(
  fc: ForecastResult,
  today: DateStr,
  accounts: Account[],
): NextPaycheckSplit | null {
  const next = fc.paychecks.find(p => !p.isActual && p.date >= today)
  if (!next) return null

  const active = accounts.filter(a => a.status !== 'closed')
  const perAccount = active.map(a => ({
    id: a.id,
    name: a.name,
    cents: next.allocations[a.id] ?? 0,
  }))

  return {
    date: next.date,
    totalCents: next.totalCents,
    freeCents: next.freeCents,
    perAccount,
  }
}

export function splitAsText(split: NextPaycheckSplit): string {
  const lines = split.perAccount.map(a => `${a.name.padEnd(16)}${fmtDollars(a.cents)}`)
  lines.push('─'.repeat(24))
  lines.push(`${'Free'.padEnd(16)}${fmtDollars(split.freeCents)}`)
  return lines.join('\n')
}
