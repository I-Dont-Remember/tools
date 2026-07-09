import type { Action } from './actions'
import { DEFAULT_STATE, type AppState } from './state'

export function dispatch(state: AppState, action: Action): AppState {
  switch (action.kind) {
    case 'AddAccount':
      return { ...state, accounts: [...state.accounts, action.account] }

    case 'EditAccount':
      return {
        ...state,
        accounts: state.accounts.map(a => a.id === action.account.id ? action.account : a),
      }

    case 'RemoveAccount':
      return {
        ...state,
        accounts: state.accounts.filter(a => a.id !== action.accountId),
      }

    case 'SetPaycheckConfig':
      return { ...state, config: action.config }

    case 'AddExternalPush':
      return { ...state, events: [...state.events, action.event] }

    case 'RemoveExternalPush':
      return { ...state, events: state.events.filter(e => e.id !== action.eventId) }

    case 'UpsertOverride': {
      const filtered = state.events.filter(
        e => !(e.kind === 'Override' && e.date === action.event.date && e.accountId === action.event.accountId),
      )
      return { ...state, events: [...filtered, action.event] }
    }

    case 'ClearOverride':
      return {
        ...state,
        events: state.events.filter(
          e => !(e.kind === 'Override' && e.date === action.date && e.accountId === action.accountId),
        ),
      }

    case 'MarkPaycheckActual': {
      const filtered = state.events.filter(
        e => !(e.kind === 'PaycheckSplit' && e.date === action.event.date),
      )
      return { ...state, events: [...filtered, action.event] }
    }

    case 'UnmarkPaycheckActual':
      return {
        ...state,
        events: state.events.filter(
          e => !(e.kind === 'PaycheckSplit' && e.date === action.date && e.status === 'actual'),
        ),
      }

    case 'LoadSeed':
      return action.state

    case 'Reset':
      return DEFAULT_STATE
  }
}
