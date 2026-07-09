import { describe, it, expect } from 'vitest'
import { validateAccount } from './validate'
import type { Account } from '../model/types'

function make(id: string, overrides: Partial<Account> = {}, bonusOverrides: Partial<Account['bonus']> = {}): Account {
  return {
    id,
    name: id,
    openedDate: '2026-01-01',
    status: 'active',
    bonus: { targetCents: 100_000, deadlineDate: '2026-06-01', ...bonusOverrides },
    ...overrides,
  }
}

describe('validateAccount', () => {
  it('returns no errors for a valid active account', () => {
    expect(validateAccount(make('a'))).toEqual([])
  })

  it('returns error when deadline is before opened date', () => {
    const errors = validateAccount(make('a', { openedDate: '2026-06-01' }, { deadlineDate: '2026-01-01' }))
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.join('')).toMatch(/deadline/i)
  })

  it('deadline equal to opened date is valid (same day fine)', () => {
    expect(validateAccount(make('a', { openedDate: '2026-04-01' }, { deadlineDate: '2026-04-01' }))).toEqual([])
  })

  it('returns error when targetCents is 0', () => {
    const errors = validateAccount(make('a', {}, { targetCents: 0 }))
    expect(errors.length).toBeGreaterThan(0)
  })

  it('returns error when targetCents is negative', () => {
    const errors = validateAccount(make('a', {}, { targetCents: -1 }))
    expect(errors.length).toBeGreaterThan(0)
  })

  it('returns no errors for closed account even with invalid fields', () => {
    const errors = validateAccount(make('a', { status: 'closed', openedDate: '2026-06-01' }, { deadlineDate: '2026-01-01', targetCents: 0 }))
    expect(errors).toEqual([])
  })

  it('returns no errors for completed account even with zero target', () => {
    const errors = validateAccount(make('a', { status: 'completed' }, { targetCents: 0 }))
    expect(errors).toEqual([])
  })
})
