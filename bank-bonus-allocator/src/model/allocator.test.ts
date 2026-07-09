import { describe, it, expect } from 'vitest'
import { forecast, feasibility } from './allocator'
import type { Account, Event, PaycheckConfig } from './types'

function pc(over: Partial<PaycheckConfig> = {}): PaycheckConfig {
  return {
    amountCents: 2_000_00,
    cadenceDays: 14,
    nextDate: '2026-07-03',
    horizonPaychecks: 8,
    ...over,
  }
}

function acct(id: string, over: Partial<Account> = {}): Account {
  return {
    id,
    name: id,
    openedDate: '2026-06-01',
    status: 'active',
    bonus: { targetCents: 1_000_00, deadlineDate: '2026-09-01' },
    ...over,
  }
}

describe('forecast', () => {
  it('one bonus, evenly paces across paychecks until deadline', () => {
    const a = acct('A', { bonus: { targetCents: 1_000_00, deadlineDate: '2026-08-31' } })
    const r = forecast({
      accounts: [a],
      config: pc(),
      events: [],
      today: '2026-06-24',
    })
    // Paychecks falling in [2026-07-03, 2026-08-31]: 7/3, 7/17, 7/31, 8/14, 8/28 = 5 paychecks
    // Required pace: ceil(100000/5) = 20000 cents each
    const future = r.paychecks.filter(p => !p.isActual)
    expect(future.length).toBeGreaterThanOrEqual(5)
    const inWindow = future.filter(p => p.date <= '2026-08-31')
    expect(inWindow.length).toBe(5)
    for (const p of inWindow) {
      expect(p.allocations['A']).toBe(20_000)
    }
    // After deadline, no more allocation to A
    const afterDeadline = future.filter(p => p.date > '2026-08-31')
    for (const p of afterDeadline) {
      expect(p.allocations['A'] ?? 0).toBe(0)
    }
    expect(r.accounts['A'].status).toBe('on-track')
    expect(r.accounts['A'].totalCents).toBeGreaterThanOrEqual(1_000_00)
  })

  it('two bonuses: soonest deadline gets priority when capacity tight', () => {
    const a = acct('A', { bonus: { targetCents: 1_000_00, deadlineDate: '2026-08-14' } })
    const b = acct('B', { bonus: { targetCents: 1_000_00, deadlineDate: '2026-09-30' } })
    const r = forecast({
      accounts: [a, b],
      config: pc({ amountCents: 500_00, horizonPaychecks: 10 }),
      events: [],
      today: '2026-06-24',
    })
    const first = r.paychecks.find(p => p.date === '2026-07-03')!
    expect(first.allocations['A']).toBeGreaterThanOrEqual(first.allocations['B'] ?? 0)
  })

  it('respects pinned override', () => {
    const a = acct('A', { bonus: { targetCents: 1_000_00, deadlineDate: '2026-09-01' } })
    const override: Event = {
      kind: 'Override',
      id: 'o1',
      date: '2026-07-03',
      accountId: 'A',
      pinCents: 50_000,
    }
    const r = forecast({
      accounts: [a],
      config: pc(),
      events: [override],
      today: '2026-06-24',
    })
    const p = r.paychecks.find(p => p.date === '2026-07-03')!
    expect(p.allocations['A']).toBe(50_000)
    expect(p.pinnedAccountIds.has('A')).toBe(true)
  })

  it('actual paycheck overrides projection and updates downstream', () => {
    const a = acct('A', { bonus: { targetCents: 1_000_00, deadlineDate: '2026-09-01' } })
    const actual: Event = {
      kind: 'PaycheckSplit',
      id: 'a1',
      date: '2026-07-03',
      status: 'actual',
      allocations: { A: 60_000 }, // big actual deposit
    }
    const r = forecast({
      accounts: [a],
      config: pc(),
      events: [actual],
      today: '2026-07-04',
    })
    const p = r.paychecks.find(p => p.date === '2026-07-03')!
    expect(p.isActual).toBe(true)
    expect(p.allocations['A']).toBe(60_000)
    // Remaining needed: 40000 over remaining paychecks before deadline
    const projTotal = r.paychecks
      .filter(p => !p.isActual && p.date <= '2026-09-01')
      .reduce((s, p) => s + (p.allocations['A'] ?? 0), 0)
    expect(projTotal).toBeLessThanOrEqual(45_000)
    expect(projTotal).toBeGreaterThanOrEqual(38_000)
  })

  it('marks bonus completed once target reached', () => {
    const a = acct('A', { bonus: { targetCents: 1_000_00, deadlineDate: '2026-09-01' } })
    const actual: Event = {
      kind: 'PaycheckSplit',
      id: 'a1',
      date: '2026-07-03',
      status: 'actual',
      allocations: { A: 100_000 }, // already done
    }
    const r = forecast({
      accounts: [a],
      config: pc(),
      events: [actual],
      today: '2026-07-04',
    })
    expect(r.accounts['A'].status).toBe('completed')
    const projTotal = r.paychecks
      .filter(p => !p.isActual)
      .reduce((s, p) => s + (p.allocations['A'] ?? 0), 0)
    expect(projTotal).toBe(0)
  })

  it('external push counts toward progress', () => {
    const a = acct('A', { bonus: { targetCents: 1_000_00, deadlineDate: '2026-09-01' } })
    const push: Event = {
      kind: 'ExternalPush',
      id: 'p1',
      date: '2026-07-04',
      status: 'actual',
      sourceLabel: 'Ally',
      targetAccountId: 'A',
      amountCents: 50_000,
    }
    const r = forecast({
      accounts: [a],
      config: pc(),
      events: [push],
      today: '2026-07-05',
    })
    expect(r.accounts['A'].progressCents).toBe(50_000)
  })

  it('completion date = push date when push completes the bonus, not earlier paycheck', () => {
    const a = acct('A', { bonus: { targetCents: 1_000_00, deadlineDate: '2026-09-01' } })
    const pc1: Event = { kind: 'PaycheckSplit', id: 'pc1', date: '2026-07-03', status: 'actual', allocations: { A: 40_000 } }
    const pc2: Event = { kind: 'PaycheckSplit', id: 'pc2', date: '2026-07-17', status: 'actual', allocations: { A: 40_000 } }
    const push: Event = {
      kind: 'ExternalPush', id: 'push1', date: '2026-07-20', status: 'actual',
      sourceLabel: 'Ally', targetAccountId: 'A', amountCents: 20_000,
    }
    const r = forecast({ accounts: [a], config: pc(), events: [pc1, pc2, push], today: '2026-07-21' })
    expect(r.accounts['A'].status).toBe('completed')
    expect(r.accounts['A'].projectedCompletionDate).toBe('2026-07-20')
  })

  it('targetCents:0 shows completed status', () => {
    const a = acct('A', { bonus: { targetCents: 0, deadlineDate: '2026-12-01' } })
    const r = forecast({ accounts: [a], config: pc(), events: [], today: '2026-06-24' })
    expect(r.accounts['A'].status).toBe('completed')
  })

  it('past-deadline unmet bonus shows missed status', () => {
    const a = acct('A', { bonus: { targetCents: 1_000_00, deadlineDate: '2026-05-01' } })
    const r = forecast({
      accounts: [a],
      config: pc(),
      events: [],
      today: '2026-06-24', // today is after deadline
    })
    expect(r.accounts['A'].status).toBe('missed')
  })
})

describe('projected external pushes', () => {
  it('projected push flips will-miss to on-track', () => {
    // 2 paychecks in window × $200 = $400 capacity < $500 target → will-miss without push
    const a = acct('A', { bonus: { targetCents: 500_00, deadlineDate: '2026-07-17' } })
    // Verify baseline: without push it's will-miss
    const baseline = forecast({
      accounts: [a],
      config: pc({ amountCents: 200_00, horizonPaychecks: 4 }),
      events: [],
      today: '2026-06-26',
    })
    expect(baseline.accounts['A'].status).toBe('will-miss')
    // With a $200 projected push: total capacity = $400 + $200 = $600 ≥ $500 → on-track
    const push: Event = {
      kind: 'ExternalPush', id: 'p1', date: '2026-07-10',
      status: 'projected', sourceLabel: 'Ally', targetAccountId: 'A', amountCents: 200_00,
    }
    const r = forecast({
      accounts: [a],
      config: pc({ amountCents: 200_00, horizonPaychecks: 4 }),
      events: [push],
      today: '2026-06-26',
    })
    expect(r.accounts['A'].status).toBe('on-track')
  })

  it('projected push reduces subsequent paycheck allocations', () => {
    // Target $500, push $400 on July 5 (between July 3 and July 17 paychecks)
    // → paychecks should only allocate the remaining $100
    const a = acct('A', { bonus: { targetCents: 500_00, deadlineDate: '2026-09-01' } })
    const push: Event = {
      kind: 'ExternalPush', id: 'p1', date: '2026-07-05',
      status: 'projected', sourceLabel: 'Ally', targetAccountId: 'A', amountCents: 400_00,
    }
    const r = forecast({
      accounts: [a],
      config: pc({ amountCents: 500_00 }),
      events: [push],
      today: '2026-06-26',
    })
    const totalPaycheckAllocated = r.paychecks
      .filter(p => !p.isActual)
      .reduce((s, p) => s + (p.allocations['A'] ?? 0), 0)
    // Push covers $400, only $100 needs to come from paychecks
    expect(totalPaycheckAllocated).toBe(100_00)
    expect(r.accounts['A'].status).toBe('on-track')
  })

  it('projected push completion date is the push date, not the paycheck date', () => {
    // Push on July 15 (between July 3 and July 17 paychecks) should set completion to July 15
    const a = acct('A', { bonus: { targetCents: 500_00, deadlineDate: '2026-09-01' } })
    const push: Event = {
      kind: 'ExternalPush', id: 'p1', date: '2026-07-15',
      status: 'projected', sourceLabel: 'Ally', targetAccountId: 'A', amountCents: 500_00,
    }
    const r = forecast({
      accounts: [a],
      config: pc({ amountCents: 500_00 }),
      events: [push],
      today: '2026-06-26',
    })
    expect(r.accounts['A'].status).toBe('on-track')
    expect(r.accounts['A'].projectedCompletionDate).toBe('2026-07-15')
  })
})

describe('feasibility', () => {
  it('returns feasible when capacity is sufficient', () => {
    const existing = acct('A', { bonus: { targetCents: 50_000, deadlineDate: '2026-09-01' } })
    const proposed = acct('NEW', { bonus: { targetCents: 1_000_00, deadlineDate: '2026-10-01' } })
    const r = feasibility({
      accounts: [existing],
      config: pc({ amountCents: 2_000_00 }),
      events: [],
      today: '2026-06-24',
      proposed,
    })
    expect(r.feasible).toBe(true)
  })

  it('returns infeasible with shortfall when capacity insufficient', () => {
    const existing = acct('A', { bonus: { targetCents: 5_000_00, deadlineDate: '2026-07-30' } })
    const proposed = acct('NEW', { bonus: { targetCents: 5_000_00, deadlineDate: '2026-07-30' } })
    const r = feasibility({
      accounts: [existing],
      config: pc({ amountCents: 100_00, horizonPaychecks: 3 }),
      events: [],
      today: '2026-06-24',
      proposed,
    })
    expect(r.feasible).toBe(false)
    expect(r.shortfalls.length).toBeGreaterThan(0)
  })
})
