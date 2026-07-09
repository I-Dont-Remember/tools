import { describe, it, expect } from 'vitest'
import { accountAlerts } from './alerts'
import type { ForecastResult } from '../model/allocator'
import type { PaycheckConfig } from '../model/types'

const config: PaycheckConfig = {
  amountCents: 2_000_00,
  cadenceDays: 14,
  nextDate: '2026-07-03',
  horizonPaychecks: 8,
}

function makeFc(overrides: Partial<ForecastResult['accounts']> = {}): ForecastResult {
  return {
    paychecks: [],
    pushes: [],
    accounts: overrides as ForecastResult['accounts'],
  }
}

const accounts = [
  { id: 'A', name: 'Chase' },
  { id: 'B', name: 'Discover' },
]

describe('accountAlerts', () => {
  it('returns empty when no will-miss or missed accounts', () => {
    const fc = makeFc({
      A: { accountId: 'A', status: 'on-track', progressCents: 0, projectedCents: 0, totalCents: 0, targetCents: 0, deadlineDate: '2026-12-01', remainingPaychecksInWindow: 5 },
    })
    expect(accountAlerts(fc, accounts, config)).toHaveLength(0)
  })

  it('returns missed alert for missed account', () => {
    const fc = makeFc({
      A: { accountId: 'A', status: 'missed', progressCents: 50_000, projectedCents: 0, totalCents: 50_000, targetCents: 100_000, shortfallCents: 50_000, deadlineDate: '2026-05-01', remainingPaychecksInWindow: 0 },
    })
    const alerts = accountAlerts(fc, accounts, config)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].kind).toBe('missed')
    expect(alerts[0].accountId).toBe('A')
    expect(alerts[0].accountName).toBe('Chase')
  })

  it('classifies will-miss as recoverable when remaining capacity >= shortfall', () => {
    // 3 paychecks × $2000/paycheck = $6000 capacity, shortfall = $5000 → recoverable
    const fc = makeFc({
      A: { accountId: 'A', status: 'will-miss', progressCents: 0, projectedCents: 0, totalCents: 0, targetCents: 500_000, shortfallCents: 500_000, deadlineDate: '2026-09-01', remainingPaychecksInWindow: 3 },
    })
    const alerts = accountAlerts(fc, accounts, config)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].kind).toBe('recoverable')
    expect(alerts[0].externalPushNeeded).toBeUndefined()
  })

  it('classifies will-miss as recoverable exactly at boundary (capacity == shortfall)', () => {
    // 2 paychecks × $2000 = $4000, shortfall = $4000 → exactly recoverable
    const fc = makeFc({
      A: { accountId: 'A', status: 'will-miss', progressCents: 0, projectedCents: 0, totalCents: 0, targetCents: 400_000, shortfallCents: 400_000, deadlineDate: '2026-09-01', remainingPaychecksInWindow: 2 },
    })
    const alerts = accountAlerts(fc, accounts, config)
    expect(alerts[0].kind).toBe('recoverable')
  })

  it('classifies will-miss as unrecoverable when capacity < shortfall', () => {
    // 1 paycheck × $2000 = $2000 capacity, shortfall = $5000 → unrecoverable, needs $3000 external
    const fc = makeFc({
      A: { accountId: 'A', status: 'will-miss', progressCents: 0, projectedCents: 0, totalCents: 0, targetCents: 500_000, shortfallCents: 500_000, deadlineDate: '2026-09-01', remainingPaychecksInWindow: 1 },
    })
    const alerts = accountAlerts(fc, accounts, config)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].kind).toBe('unrecoverable')
    expect(alerts[0].externalPushNeeded).toBe(300_000) // 500k - 1×200k
  })

  it('classifies will-miss with 0 remaining paychecks as unrecoverable', () => {
    const fc = makeFc({
      A: { accountId: 'A', status: 'will-miss', progressCents: 0, projectedCents: 0, totalCents: 0, targetCents: 100_000, shortfallCents: 100_000, deadlineDate: '2026-04-15', remainingPaychecksInWindow: 0 },
    })
    const alerts = accountAlerts(fc, accounts, config)
    expect(alerts[0].kind).toBe('unrecoverable')
    expect(alerts[0].externalPushNeeded).toBe(100_000)
  })

  it('uses account name from accounts list', () => {
    const fc = makeFc({
      B: { accountId: 'B', status: 'missed', progressCents: 0, projectedCents: 0, totalCents: 0, targetCents: 100_000, shortfallCents: 100_000, deadlineDate: '2026-05-01', remainingPaychecksInWindow: 0 },
    })
    const alerts = accountAlerts(fc, accounts, config)
    expect(alerts[0].accountName).toBe('Discover')
  })

  it('returns multiple alerts for multiple flagged accounts', () => {
    const fc = makeFc({
      A: { accountId: 'A', status: 'missed', progressCents: 0, projectedCents: 0, totalCents: 0, targetCents: 100_000, shortfallCents: 100_000, deadlineDate: '2026-05-01', remainingPaychecksInWindow: 0 },
      B: { accountId: 'B', status: 'will-miss', progressCents: 0, projectedCents: 0, totalCents: 0, targetCents: 100_000, shortfallCents: 100_000, deadlineDate: '2026-09-01', remainingPaychecksInWindow: 2 },
    })
    const alerts = accountAlerts(fc, accounts, config)
    expect(alerts).toHaveLength(2)
  })

  it('skips pre-start, on-track, completed, closed accounts', () => {
    const fc = makeFc({
      A: { accountId: 'A', status: 'pre-start', progressCents: 0, projectedCents: 0, totalCents: 0, targetCents: 100_000, deadlineDate: '2026-12-01', remainingPaychecksInWindow: 5 },
      B: { accountId: 'B', status: 'completed', progressCents: 100_000, projectedCents: 0, totalCents: 100_000, targetCents: 100_000, deadlineDate: '2026-12-01', remainingPaychecksInWindow: 5 },
    })
    expect(accountAlerts(fc, accounts, config)).toHaveLength(0)
  })
})
