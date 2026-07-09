import type { Account, Event, PaycheckConfig } from '../model/types'

export interface AppState {
  config: PaycheckConfig
  accounts: Account[]
  events: Event[]
}

export const DEFAULT_STATE: AppState = {
  config: {
    amountCents: 2_500_00,
    cadenceDays: 14,
    nextDate: '2026-07-03',
    horizonPaychecks: 10,
  },
  accounts: [],
  events: [],
}
