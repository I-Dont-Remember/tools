import { describe, it, expect } from 'vitest'
import { displayedAccounts } from './grid-helpers'
import type { Account } from '../model/types'
import type { ProjectedPaycheck } from '../model/allocator'

function makeAccount(id: string, status: Account['status'] = 'active'): Account {
  return {
    id,
    name: id,
    openedDate: '2026-01-01',
    status,
    bonus: { targetCents: 100_000, deadlineDate: '2026-06-01' },
  }
}

function makePaycheck(date: string, allocations: Record<string, number>): ProjectedPaycheck {
  return {
    date,
    isActual: true,
    allocations,
    pinnedAccountIds: new Set(),
    totalCents: Object.values(allocations).reduce((a, b) => a + b, 0),
    freeCents: 0,
    overCapacity: false,
  }
}

describe('displayedAccounts', () => {
  it('includes all non-closed accounts', () => {
    const accounts = [makeAccount('a'), makeAccount('b')]
    expect(displayedAccounts(accounts, []).map(a => a.id)).toEqual(['a', 'b'])
  })

  it('includes a closed account that has a non-zero allocation in some paycheck', () => {
    const accounts = [makeAccount('a'), makeAccount('gone', 'closed')]
    const paychecks = [makePaycheck('2026-03-20', { gone: 50_000, a: 100_000 })]
    expect(displayedAccounts(accounts, paychecks).map(a => a.id)).toEqual(['a', 'gone'])
  })

  it('excludes a closed account with no historical allocation', () => {
    const accounts = [makeAccount('a'), makeAccount('gone', 'closed')]
    expect(displayedAccounts(accounts, []).map(a => a.id)).toEqual(['a'])
  })

  it('excludes a closed account with only zero allocations', () => {
    const accounts = [makeAccount('a'), makeAccount('gone', 'closed')]
    const paychecks = [makePaycheck('2026-03-20', { gone: 0, a: 100_000 })]
    expect(displayedAccounts(accounts, paychecks).map(a => a.id)).toEqual(['a'])
  })

  it('preserves original account order (closed-with-history stays in place)', () => {
    const accounts = [makeAccount('c'), makeAccount('gone', 'closed'), makeAccount('a')]
    const paychecks = [makePaycheck('2026-03-20', { gone: 50_000 })]
    expect(displayedAccounts(accounts, paychecks).map(a => a.id)).toEqual(['c', 'gone', 'a'])
  })

  it('returns empty when all accounts are closed with no history', () => {
    const accounts = [makeAccount('x', 'closed')]
    expect(displayedAccounts(accounts, [])).toEqual([])
  })
})
