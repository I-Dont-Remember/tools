import type { Event, State } from './types'

export function emptyState(): State {
  return {
    actualByAccount: {},
    overrides: {},
    actualPaychecks: {},
    actualPushes: {},
  }
}

export function replay(events: Event[]): State {
  const s = emptyState()
  for (const e of events) {
    switch (e.kind) {
      case 'PaycheckSplit': {
        if (e.status !== 'actual') break
        s.actualPaychecks[e.date] = { ...(s.actualPaychecks[e.date] ?? {}) }
        for (const [accountId, cents] of Object.entries(e.allocations)) {
          s.actualPaychecks[e.date][accountId] =
            (s.actualPaychecks[e.date][accountId] ?? 0) + cents
          s.actualByAccount[accountId] = (s.actualByAccount[accountId] ?? 0) + cents
        }
        break
      }
      case 'ExternalPush': {
        if (e.status !== 'actual') break
        s.actualPushes[e.date] ??= []
        s.actualPushes[e.date].push(e)
        s.actualByAccount[e.targetAccountId] =
          (s.actualByAccount[e.targetAccountId] ?? 0) + e.amountCents
        break
      }
      case 'Override': {
        s.overrides[e.date] ??= {}
        s.overrides[e.date][e.accountId] = e.pinCents
        break
      }
    }
  }
  return s
}
