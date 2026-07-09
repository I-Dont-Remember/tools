// All money in integer cents. All dates ISO 'YYYY-MM-DD' strings.

export type Cents = number
export type DateStr = string // 'YYYY-MM-DD'

export interface Account {
  id: string
  name: string
  openedDate: DateStr
  bonus: {
    targetCents: Cents
    deadlineDate: DateStr
    startDate?: DateStr // when DD requirement window begins; defaults to openedDate
  }
  status: 'active' | 'completed' | 'closed'
  notes?: string
}

export interface PaycheckConfig {
  amountCents: Cents
  cadenceDays: number // 14 for biweekly
  nextDate: DateStr // anchor for the schedule; past dates with no event are still considered scheduled
  horizonPaychecks: number // how many paychecks to forecast
}

export type EventKind = 'PaycheckSplit' | 'ExternalPush' | 'Override'

export interface PaycheckSplitEvent {
  kind: 'PaycheckSplit'
  id: string
  date: DateStr
  status: 'projected' | 'actual'
  allocations: Record<string /* accountId */, Cents>
}

export interface ExternalPushEvent {
  kind: 'ExternalPush'
  id: string
  date: DateStr
  status: 'projected' | 'actual'
  sourceLabel: string // e.g. 'Ally'
  targetAccountId: string
  amountCents: Cents
}

export interface OverrideEvent {
  kind: 'Override'
  id: string
  date: DateStr
  accountId: string
  pinCents: Cents // user-pinned allocation for that paycheck date
}

export type Event = PaycheckSplitEvent | ExternalPushEvent | OverrideEvent

export interface State {
  // Total deposits per account (across paychecks + external pushes), from actuals only.
  actualByAccount: Record<string, Cents>
  // Pinned overrides indexed by date+account.
  overrides: Record<string /* date */, Record<string /* accountId */, Cents>>
  // Actuals indexed by date (for paycheck splits).
  actualPaychecks: Record<string /* date */, Record<string /* accountId */, Cents>>
  // Actual external pushes indexed by date (multiple per date possible -> list).
  actualPushes: Record<string /* date */, ExternalPushEvent[]>
}
