import { describe, it, expect } from 'vitest'
import { nextPaycheckSplit, splitAsText } from './nextPaycheck'
import type { ForecastResult } from '../model/allocator'
import type { Account } from '../model/types'

function makeAccount(id: string, name: string, status: Account['status'] = 'active'): Account {
  return {
    id,
    name,
    openedDate: '2026-01-01',
    status,
    bonus: { targetCents: 100_000, deadlineDate: '2026-12-01' },
  }
}

function makeFc(paychecks: ForecastResult['paychecks'] = []): ForecastResult {
  return { paychecks, pushes: [], accounts: {} }
}

describe('nextPaycheckSplit', () => {
  it('returns null when no future paychecks', () => {
    expect(nextPaycheckSplit(makeFc([]), '2026-07-01', [])).toBeNull()
  })

  it('returns null when only past paychecks', () => {
    const fc = makeFc([
      { date: '2026-06-01', isActual: true, allocations: {}, pinnedAccountIds: new Set(), totalCents: 0, freeCents: 0, overCapacity: false },
    ])
    expect(nextPaycheckSplit(fc, '2026-07-01', [])).toBeNull()
  })

  it('returns the first future non-actual paycheck', () => {
    const accounts = [makeAccount('A', 'Chase')]
    const fc = makeFc([
      { date: '2026-06-15', isActual: true, allocations: { A: 100_00 }, pinnedAccountIds: new Set(), totalCents: 100_00, freeCents: 0, overCapacity: false },
      { date: '2026-07-03', isActual: false, allocations: { A: 200_00 }, pinnedAccountIds: new Set(), totalCents: 200_00, freeCents: 0, overCapacity: false },
      { date: '2026-07-17', isActual: false, allocations: { A: 200_00 }, pinnedAccountIds: new Set(), totalCents: 200_00, freeCents: 0, overCapacity: false },
    ])
    const result = nextPaycheckSplit(fc, '2026-07-01', accounts)
    expect(result?.date).toBe('2026-07-03')
    expect(result?.perAccount[0].cents).toBe(200_00)
  })

  it('includes free cents correctly', () => {
    const accounts = [makeAccount('A', 'Chase')]
    const fc = makeFc([
      { date: '2026-07-03', isActual: false, allocations: { A: 150_00 }, pinnedAccountIds: new Set(), totalCents: 150_00, freeCents: 50_00, overCapacity: false },
    ])
    const result = nextPaycheckSplit(fc, '2026-06-24', accounts)
    expect(result?.totalCents).toBe(150_00)
    expect(result?.freeCents).toBe(50_00)
  })

  it('excludes closed accounts from perAccount list', () => {
    const accounts = [makeAccount('A', 'Chase', 'active'), makeAccount('B', 'Closed', 'closed')]
    const fc = makeFc([
      { date: '2026-07-03', isActual: false, allocations: { A: 100_00, B: 50_00 }, pinnedAccountIds: new Set(), totalCents: 150_00, freeCents: 0, overCapacity: false },
    ])
    const result = nextPaycheckSplit(fc, '2026-06-24', accounts)
    expect(result?.perAccount.find(a => a.id === 'B')).toBeUndefined()
    expect(result?.perAccount.find(a => a.id === 'A')?.cents).toBe(100_00)
  })

  it('includes accounts with zero allocation in perAccount', () => {
    const accounts = [makeAccount('A', 'Chase'), makeAccount('B', 'Wells')]
    const fc = makeFc([
      { date: '2026-07-03', isActual: false, allocations: { A: 200_00 }, pinnedAccountIds: new Set(), totalCents: 200_00, freeCents: 0, overCapacity: false },
    ])
    const result = nextPaycheckSplit(fc, '2026-06-24', accounts)
    // Both active accounts should appear (B with 0)
    expect(result?.perAccount).toHaveLength(2)
    expect(result?.perAccount.find(a => a.id === 'B')?.cents).toBe(0)
  })
})

describe('splitAsText', () => {
  it('formats split as text with correct alignment', () => {
    const split = {
      date: '2026-07-03',
      totalCents: 250_000,
      freeCents: 0,
      perAccount: [
        { id: 'A', name: 'Chase', cents: 100_000 },
        { id: 'B', name: 'Wells Fargo', cents: 150_000 },
      ],
    }
    const text = splitAsText(split)
    expect(text).toContain('Chase')
    expect(text).toContain('$1,000')
    expect(text).toContain('Wells Fargo')
    expect(text).toContain('$1,500')
    expect(text).toContain('Free')
    expect(text).toContain('$0')
  })
})
