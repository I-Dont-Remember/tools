import { DEFAULT_STATE, type AppState } from './core/state'

export type { AppState }
export type Persisted = AppState

const KEY = 'bank-bonus-allocator/v1'
const EXAMPLE_KEY = 'bank-bonus-allocator/example'
const TODAY_KEY = 'bank-bonus-allocator/today'

export function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return DEFAULT_STATE
  }
}

export function save(p: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function reset(): void {
  localStorage.removeItem(KEY)
}

export function loadExample(): boolean {
  try {
    return localStorage.getItem(EXAMPLE_KEY) === 'true'
  } catch {
    return false
  }
}

export function saveExample(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(EXAMPLE_KEY, 'true')
    } else {
      localStorage.removeItem(EXAMPLE_KEY)
    }
  } catch {
    // ignore (e.g. private-browsing quotas)
  }
}

export function loadToday(): string | null {
  try {
    return localStorage.getItem(TODAY_KEY)
  } catch {
    return null
  }
}

export function saveToday(d: string): void {
  try {
    localStorage.setItem(TODAY_KEY, d)
  } catch {
    // ignore
  }
}

export function resetToday(): void {
  try {
    localStorage.removeItem(TODAY_KEY)
  } catch {
    // ignore
  }
}
