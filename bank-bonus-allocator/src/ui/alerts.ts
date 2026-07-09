import type { ForecastResult } from '../model/allocator'
import type { PaycheckConfig, DateStr } from '../model/types'

export type AlertKind = 'missed' | 'recoverable' | 'unrecoverable'

export interface AccountAlert {
  kind: AlertKind
  accountId: string
  accountName: string
  shortfallCents: number
  deadlineDate: DateStr
  remainingPaychecks: number
  externalPushNeeded?: number // only for unrecoverable
}

export function accountAlerts(
  fc: ForecastResult,
  accounts: { id: string; name: string }[],
  config: PaycheckConfig,
): AccountAlert[] {
  const alerts: AccountAlert[] = []
  for (const [id, summary] of Object.entries(fc.accounts)) {
    if (summary.status !== 'will-miss' && summary.status !== 'missed') continue
    const name = accounts.find(a => a.id === id)?.name ?? id

    if (summary.status === 'missed') {
      alerts.push({
        kind: 'missed',
        accountId: id,
        accountName: name,
        shortfallCents: summary.shortfallCents ?? 0,
        deadlineDate: summary.deadlineDate,
        remainingPaychecks: 0,
      })
      continue
    }

    // will-miss: check if recoverable via paycheck reallocation alone
    const shortfall = summary.shortfallCents ?? 0
    const remaining = summary.remainingPaychecksInWindow
    const capacity = remaining * config.amountCents

    if (capacity >= shortfall) {
      alerts.push({
        kind: 'recoverable',
        accountId: id,
        accountName: name,
        shortfallCents: shortfall,
        deadlineDate: summary.deadlineDate,
        remainingPaychecks: remaining,
      })
    } else {
      alerts.push({
        kind: 'unrecoverable',
        accountId: id,
        accountName: name,
        shortfallCents: shortfall,
        deadlineDate: summary.deadlineDate,
        remainingPaychecks: remaining,
        externalPushNeeded: shortfall - capacity,
      })
    }
  }
  return alerts
}
