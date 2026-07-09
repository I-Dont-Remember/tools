import type { Account, DateStr } from '../model/types'
import { forecast, feasibility, type ForecastResult, type FeasibilityResult } from '../model/allocator'
import { fmtDollars } from '../money'
import type { AppState } from './state'

export function currentForecast(state: AppState, today: DateStr): ForecastResult {
  return forecast({ accounts: state.accounts, config: state.config, events: state.events, today })
}

export function feasibilityOf(state: AppState, proposed: Account, today: DateStr): FeasibilityResult {
  return feasibility({ accounts: state.accounts, config: state.config, events: state.events, today, proposed })
}

export function renderForecastTable(state: AppState, today: DateStr): string {
  const fc = currentForecast(state, today)
  const active = state.accounts.filter(a => a.status !== 'closed')
  if (active.length === 0) return '(no accounts)'

  const header = 'Date       | ' + active.map(a => a.name.substring(0, 8).padEnd(8)).join(' | ') + ' | Total    | Free'
  const sep = '-'.repeat(header.length)
  const rows = fc.paychecks.map(p => {
    const cells = active.map(a => fmtDollars(p.allocations[a.id] ?? 0).padEnd(8)).join(' | ')
    const flag = p.isActual ? '✓' : p.overCapacity ? '!' : ' '
    return `${flag}${p.date} | ${cells} | ${fmtDollars(p.totalCents).padEnd(8)} | ${fmtDollars(p.freeCents)}`
  })

  return [header, sep, ...rows].join('\n')
}

export function renderAccountsSummary(state: AppState, today: DateStr): string {
  const fc = currentForecast(state, today)
  if (state.accounts.length === 0) return '(no accounts)'
  return state.accounts
    .map(a => {
      const s = fc.accounts[a.id]
      const parts = [
        a.name.padEnd(14),
        s.status.padEnd(11),
        `progress=${fmtDollars(s.progressCents)}`,
        `projected=${fmtDollars(s.projectedCents)}`,
        `target=${fmtDollars(s.targetCents)}`,
        `deadline=${s.deadlineDate}`,
      ]
      if (s.projectedCompletionDate) parts.push(`done=${s.projectedCompletionDate}`)
      if (s.shortfallCents) parts.push(`SHORT=${fmtDollars(s.shortfallCents)}`)
      return parts.join(' ')
    })
    .join('\n')
}

export function renderHorizonWarning(state: AppState, today: DateStr): string | null {
  const fc = currentForecast(state, today)
  const lastDate = fc.paychecks[fc.paychecks.length - 1]?.date
  if (!lastDate) return null
  const stale = Object.values(fc.accounts).filter(
    s => s.status === 'will-miss' && s.deadlineDate > lastDate,
  )
  if (stale.length === 0) return null
  const names = stale.map(s => state.accounts.find(a => a.id === s.accountId)?.name ?? s.accountId)
  return `⚠ ${names.join(', ')} show will-miss but deadline is beyond the forecast window — increase horizonPaychecks to see the full picture.`
}

export function renderCapacityProfile(state: AppState, today: DateStr): string {
  const fc = currentForecast(state, today)
  if (fc.paychecks.length === 0) return '(no paychecks in horizon)'
  const cap = state.config.amountCents
  return fc.paychecks
    .map(p => {
      const pct = Math.min(1, p.totalCents / cap)
      const filled = Math.round(pct * 20)
      const bar = '█'.repeat(filled) + '░'.repeat(20 - filled)
      const flag = p.overCapacity ? '!' : p.isActual ? '✓' : ' '
      return `${flag}${p.date} [${bar}] ${fmtDollars(p.totalCents)}/${fmtDollars(cap)} free=${fmtDollars(p.freeCents)}`
    })
    .join('\n')
}
