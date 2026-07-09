import type { Account, DateStr, ExternalPushEvent, OverrideEvent, PaycheckConfig, PaycheckSplitEvent } from '../model/types'
import type { AppState } from './state'

export type Action =
  | { kind: 'AddAccount'; account: Account }
  | { kind: 'EditAccount'; account: Account }
  | { kind: 'RemoveAccount'; accountId: string }
  | { kind: 'SetPaycheckConfig'; config: PaycheckConfig }
  | { kind: 'AddExternalPush'; event: ExternalPushEvent }
  | { kind: 'RemoveExternalPush'; eventId: string }
  | { kind: 'UpsertOverride'; event: OverrideEvent }
  | { kind: 'ClearOverride'; date: DateStr; accountId: string }
  | { kind: 'MarkPaycheckActual'; event: PaycheckSplitEvent }
  | { kind: 'UnmarkPaycheckActual'; date: DateStr }
  | { kind: 'LoadSeed'; state: AppState; today: DateStr }
  | { kind: 'Reset' }
