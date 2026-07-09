import type { Account, Event, PaycheckConfig } from '../model/types'

type SeedResult = { config: PaycheckConfig; accounts: Account[]; events: Event[]; today: string }

// Seed approximating the user's real scenario from their notes (mid-2026 dates).
// Last actual paycheck was 3/20 in their notes; we move the timeline forward so
// the user can see it work today.
export function seedScenario(): SeedResult {
  const today = '2026-04-04'
  const config: PaycheckConfig = {
    amountCents: 2_500_00, // approx sum of their elections (~2389 + slack)
    cadenceDays: 14,
    nextDate: '2026-04-17',
    horizonPaychecks: 8,
  }
  const accounts: Account[] = [
    {
      id: 'citi',
      name: 'Citibonk',
      openedDate: '2026-02-26',
      status: 'active',
      bonus: { targetCents: 3_000_00, deadlineDate: '2026-05-28' },
    },
    {
      id: 'byline',
      name: 'Bylinear Bank',
      openedDate: '2026-01-15',
      status: 'active',
      bonus: { targetCents: 4_000_00, deadlineDate: '2026-04-15' },
    },
    {
      id: 'wellsf',
      name: 'Wells Cargo',
      openedDate: '2026-02-15',
      status: 'active',
      bonus: { targetCents: 1_000_00, deadlineDate: '2026-05-27' },
    },
    {
      id: 'hunt',
      name: 'Hunten Bank',
      openedDate: '2026-01-01',
      status: 'completed',
      bonus: { targetCents: 0, deadlineDate: '2026-04-01' }, // bonus done
    },
    {
      id: 'busey',
      name: 'Snoozey',
      openedDate: '2026-03-15',
      status: 'active',
      bonus: { targetCents: 5_000_00, deadlineDate: '2026-06-15' },
    },
    {
      id: 'bcu',
      name: 'Fake Credit Union',
      openedDate: '2026-04-08',
      status: 'active',
      bonus: { targetCents: 3_000_00, deadlineDate: '2026-06-07' },
    },
  ]
  // Past actual paychecks from the user's notes (3/6, 3/20)
  const events: Event[] = [
    {
      kind: 'PaycheckSplit',
      id: 'a-306',
      date: '2026-03-06',
      status: 'actual',
      allocations: { citi: 601_00, byline: 501_00, wellsf: 201_00, hunt: 501_00 },
    },
    {
      kind: 'PaycheckSplit',
      id: 'a-320',
      date: '2026-03-20',
      status: 'actual',
      allocations: { citi: 601_00, byline: 501_00, wellsf: 201_00, hunt: 501_00 },
    },
    // Actual ACH push — Wells Cargo, already sent; shows up in "Progress so far" in breakdown
    {
      kind: 'ExternalPush',
      id: 'push-wellsf-actual',
      date: '2026-03-28',
      status: 'actual',
      sourceLabel: 'Marcus savings',
      targetAccountId: 'wellsf',
      amountCents: 300_00,
    },
    // Planned ACH push — Bylinear Bank, intentionally partial so will-miss + warning stay visible;
    // demonstrates that a planned push counts in the forecast even before it's sent
    {
      kind: 'ExternalPush',
      id: 'push-byline-planned',
      date: '2026-04-12',
      status: 'projected',
      sourceLabel: 'Ally savings',
      targetAccountId: 'byline',
      amountCents: 1_000_00,
    },
  ]
  return { config, accounts, events, today }
}

// Urgent deadline pressure: Discover needs to finish in 2 paychecks, Chase is close behind,
// KeyBank starts fresh. Shows deadline-priority sorting and tight capacity.
export function seedTightDeadlines(): SeedResult {
  const today = '2026-06-24'
  const config: PaycheckConfig = {
    amountCents: 2_000_00,
    cadenceDays: 14,
    nextDate: '2026-07-03',
    horizonPaychecks: 8,
  }
  const accounts: Account[] = [
    {
      id: 'chase',
      name: 'Chasm Bank',
      openedDate: '2026-03-01',
      status: 'active',
      bonus: { targetCents: 3_000_00, deadlineDate: '2026-08-15' },
    },
    {
      id: 'discover',
      name: 'Discovert',
      openedDate: '2026-04-01',
      status: 'active',
      bonus: { targetCents: 1_500_00, deadlineDate: '2026-07-17' },
    },
    {
      id: 'keybank',
      name: 'KeyBoard Bank',
      openedDate: '2026-06-15',
      status: 'active',
      bonus: { targetCents: 2_500_00, deadlineDate: '2026-09-30' },
    },
  ]
  const events: Event[] = [
    // Chase: 3 actuals of $600 = $1800 done, $1200 left
    { kind: 'PaycheckSplit', id: 'td-1', date: '2026-03-12', status: 'actual', allocations: { chase: 60_000 } },
    { kind: 'PaycheckSplit', id: 'td-2', date: '2026-03-26', status: 'actual', allocations: { chase: 60_000 } },
    { kind: 'PaycheckSplit', id: 'td-3', date: '2026-04-09', status: 'actual', allocations: { chase: 60_000 } },
    // Discover: 2 actuals of $500 = $1000 done, $500 left over 2 paychecks
    { kind: 'PaycheckSplit', id: 'td-4', date: '2026-05-01', status: 'actual', allocations: { discover: 50_000, chase: 40_000 } },
    { kind: 'PaycheckSplit', id: 'td-5', date: '2026-06-12', status: 'actual', allocations: { discover: 50_000, chase: 40_000 } },
  ]
  return { config, accounts, events, today }
}

// Mixed states: completed bonus, two fee-min ongoing obligations, and a new account starting
// next month. Shows the full range of account status modes.
export function seedCompletedFeeMin(): SeedResult {
  const today = '2026-06-24'
  const config: PaycheckConfig = {
    amountCents: 2_500_00,
    cadenceDays: 14,
    nextDate: '2026-07-03',
    horizonPaychecks: 10,
  }
  const accounts: Account[] = [
    {
      id: 'citi2',
      name: 'Citibonk',
      openedDate: '2026-01-01',
      status: 'active',
      bonus: { targetCents: 3_000_00, deadlineDate: '2026-05-31' },
    },
    {
      id: 'ally',
      name: 'AllyOops',
      openedDate: '2026-01-01',
      status: 'completed',
      bonus: { targetCents: 0, deadlineDate: '2026-01-01' }, // bonus done
    },
    {
      id: 'syf',
      name: 'Synkrony',
      openedDate: '2026-01-01',
      status: 'completed',
      bonus: { targetCents: 0, deadlineDate: '2026-01-01' }, // bonus done
    },
    {
      id: 'bmo',
      name: 'BMOizza',
      openedDate: '2026-07-01', // starts next month — will show as pre-start until 7/1
      status: 'active',
      bonus: { targetCents: 4_000_00, deadlineDate: '2026-10-31' },
    },
  ]
  // Citi actuals: 4 × $750 = $3000 = target (completed)
  const events: Event[] = [
    { kind: 'PaycheckSplit', id: 'cf-1', date: '2026-02-12', status: 'actual', allocations: { citi2: 75_000, ally: 12_500, syf: 25_000 } },
    { kind: 'PaycheckSplit', id: 'cf-2', date: '2026-02-26', status: 'actual', allocations: { citi2: 75_000, ally: 12_500, syf: 25_000 } },
    { kind: 'PaycheckSplit', id: 'cf-3', date: '2026-03-12', status: 'actual', allocations: { citi2: 75_000, ally: 12_500, syf: 25_000 } },
    { kind: 'PaycheckSplit', id: 'cf-4', date: '2026-03-26', status: 'actual', allocations: { citi2: 75_000, ally: 12_500, syf: 25_000 } },
  ]
  return { config, accounts, events, today }
}

export const SEED_SCENARIOS: { label: string; load: () => SeedResult }[] = [
  { label: 'Mid-stream (6 accounts)', load: seedScenario },
  { label: 'Tight Deadlines', load: seedTightDeadlines },
  { label: 'Completed + Fee-min', load: seedCompletedFeeMin },
]
