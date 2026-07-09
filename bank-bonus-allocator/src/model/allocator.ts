import type {
  Account,
  Cents,
  DateStr,
  Event,
  ExternalPushEvent,
  PaycheckConfig,
} from './types'
import { addDays, cmp } from './dates'
import { replay } from './replay'

export interface AllocatorInput {
  accounts: Account[]
  config: PaycheckConfig
  events: Event[]
  today: DateStr
}

export interface ProjectedPaycheck {
  date: DateStr
  isActual: boolean
  allocations: Record<string, Cents>
  pinnedAccountIds: Set<string>
  totalCents: Cents
  freeCents: Cents
  overCapacity: boolean
}

export interface AccountSummary {
  accountId: string
  progressCents: Cents // from actuals only
  projectedCents: Cents // from projected future paychecks (not pushes)
  projectedPushCents?: Cents // from projected external pushes (planned, not yet sent)
  totalCents: Cents // progress + projected + projectedPush
  targetCents: Cents
  status: 'completed' | 'on-track' | 'will-miss' | 'missed' | 'closed' | 'pre-start'
  projectedCompletionDate?: DateStr
  shortfallCents?: Cents
  deadlineDate: DateStr
  remainingPaychecksInWindow: number
}

export interface ForecastResult {
  paychecks: ProjectedPaycheck[]
  pushes: ExternalPushEvent[]
  accounts: Record<string, AccountSummary>
}

function generatePaycheckDates(config: PaycheckConfig, extras: DateStr[]): DateStr[] {
  const dates = new Set<DateStr>(extras)
  let d = config.nextDate
  for (let i = 0; i < config.horizonPaychecks; i++) {
    dates.add(d)
    d = addDays(d, config.cadenceDays)
  }
  return [...dates].sort(cmp)
}

function paychecksRemainingInWindow(
  fromDate: DateStr,
  endDate: DateStr,
  allPaycheckDates: DateStr[],
): number {
  return allPaycheckDates.filter(d => cmp(d, fromDate) >= 0 && cmp(d, endDate) <= 0).length
}


export function forecast(input: AllocatorInput): ForecastResult {
  const { accounts, config, events, today } = input
  const state = replay(events)

  // Gather all paycheck dates: scheduled future + any actual paycheck dates from events
  const actualDates = events
    .filter((e): e is Extract<Event, { kind: 'PaycheckSplit' }> => e.kind === 'PaycheckSplit' && e.status === 'actual')
    .map(e => e.date)
  const paycheckDates = generatePaycheckDates(config, actualDates)

  // Running progress (actual + projected) per account
  const runningTotal: Record<string, Cents> = {}
  for (const acc of accounts) {
    runningTotal[acc.id] = state.actualByAccount[acc.id] ?? 0
  }

  // Add actual external pushes already counted in state.actualByAccount

  // Track projected completion dates
  const projectedCompletion: Record<string, DateStr> = {}

  // Pre-loop: accounts already at target via actuals get completion = last actual event date.
  // Without this, the loop would attribute completion to the first paycheck in history even
  // if a later push was what actually crossed the finish line (Q2 fix).
  for (const acc of accounts) {
    if (acc.bonus.targetCents > 0 && (runningTotal[acc.id] ?? 0) >= acc.bonus.targetCents) {
      const lastDate = events
        .filter(e => {
          if (e.kind === 'PaycheckSplit' && e.status === 'actual') return (e.allocations[acc.id] ?? 0) > 0
          if (e.kind === 'ExternalPush' && e.status === 'actual') return e.targetAccountId === acc.id
          return false
        })
        .map(e => e.date)
        .sort(cmp)
        .pop()
      if (lastDate) projectedCompletion[acc.id] = lastDate
    }
  }

  // All pushes for display
  const pushes: ExternalPushEvent[] = events
    .filter((e): e is ExternalPushEvent => e.kind === 'ExternalPush')
    .sort((a, b) => cmp(a.date, b.date))

  // Projected pushes applied in the forecast loop (sorted by date).
  // No deadline filter — matches parity with how actual pushes count regardless of deadline.
  const projectedPushes = pushes.filter(p => p.status !== 'actual')
  // Track per-account push totals separately so summary can show them
  const projectedPushByAccount: Record<string, Cents> = {}
  let projPushPtr = 0

  // Helper: apply one projected push to runningTotal and track completion
  const applyProjectedPush = (push: ExternalPushEvent) => {
    runningTotal[push.targetAccountId] = (runningTotal[push.targetAccountId] ?? 0) + push.amountCents
    projectedPushByAccount[push.targetAccountId] = (projectedPushByAccount[push.targetAccountId] ?? 0) + push.amountCents
    const acc = accounts.find(a => a.id === push.targetAccountId)
    if (
      acc &&
      !projectedCompletion[push.targetAccountId] &&
      acc.bonus.targetCents > 0 &&
      runningTotal[push.targetAccountId] >= acc.bonus.targetCents
    ) {
      projectedCompletion[push.targetAccountId] = push.date
    }
  }

  const projectedPaychecks: ProjectedPaycheck[] = []

  for (const date of paycheckDates) {
    // Apply any projected pushes whose date falls on or before this paycheck date.
    // Advances the pointer even for actual/past paycheck iterations so timing is correct.
    while (projPushPtr < projectedPushes.length && cmp(projectedPushes[projPushPtr].date, date) <= 0) {
      applyProjectedPush(projectedPushes[projPushPtr])
      projPushPtr++
    }
    // Use actual if present
    const actualEvent = events.find(
      (e): e is Extract<Event, { kind: 'PaycheckSplit' }> =>
        e.kind === 'PaycheckSplit' && e.status === 'actual' && e.date === date,
    )

    if (actualEvent) {
      const allocations = { ...actualEvent.allocations }
      const total = sum(Object.values(allocations))
      projectedPaychecks.push({
        date,
        isActual: true,
        allocations,
        pinnedAccountIds: new Set(),
        totalCents: total,
        freeCents: config.amountCents - total,
        overCapacity: total > config.amountCents,
      })
      // Already folded into runningTotal/monthTotal via replay
      // But check completion
      for (const acc of accounts) {
        if (
          !projectedCompletion[acc.id] &&
          runningTotal[acc.id] >= acc.bonus.targetCents &&
          acc.bonus.targetCents > 0
        ) {
          projectedCompletion[acc.id] = date
        }
      }
      continue
    }

    // Skip past dates (no actual) — don't generate projections for the past
    if (cmp(date, today) < 0) continue

    // Allocate this paycheck
    const overrides = state.overrides[date] ?? {}
    const allocations: Record<string, Cents> = {}
    const pinned = new Set<string>()
    let remaining = config.amountCents

    // 1. Apply pinned overrides first
    for (const [accId, cents] of Object.entries(overrides)) {
      if (!accounts.some(a => a.id === accId)) continue
      allocations[accId] = cents
      pinned.add(accId)
      remaining -= cents
      runningTotal[accId] = (runningTotal[accId] ?? 0) + cents
    }

    // 2. Bonus-target allocation: build candidates with required pace
    const candidates = accounts
      .filter(a => a.status === 'active')
      .filter(a => !pinned.has(a.id))
      .filter(a => cmp(date, a.bonus.startDate ?? a.openedDate) >= 0)
      .filter(a => cmp(date, a.bonus.deadlineDate) <= 0)
      .filter(a => runningTotal[a.id] < a.bonus.targetCents)
      .map(a => {
        const paychecksLeft = paychecksRemainingInWindow(
          date,
          a.bonus.deadlineDate,
          paycheckDates,
        )
        const need = a.bonus.targetCents - runningTotal[a.id]
        const pace = paychecksLeft > 0 ? Math.ceil(need / paychecksLeft) : need
        return { acc: a, pace, paychecksLeft }
      })
      .sort((x, y) => {
        // Soonest deadline first, then highest pace
        const dc = cmp(x.acc.bonus.deadlineDate, y.acc.bonus.deadlineDate)
        if (dc !== 0) return dc
        return y.pace - x.pace
      })

    for (const c of candidates) {
      if (remaining <= 0) break
      const want = Math.min(c.pace, remaining, c.acc.bonus.targetCents - runningTotal[c.acc.id])
      if (want <= 0) continue
      allocations[c.acc.id] = (allocations[c.acc.id] ?? 0) + want
      remaining -= want
      runningTotal[c.acc.id] += want
      if (
        !projectedCompletion[c.acc.id] &&
        runningTotal[c.acc.id] >= c.acc.bonus.targetCents
      ) {
        projectedCompletion[c.acc.id] = date
      }
    }

    const total = sum(Object.values(allocations))
    projectedPaychecks.push({
      date,
      isActual: false,
      allocations,
      pinnedAccountIds: pinned,
      totalCents: total,
      freeCents: config.amountCents - total,
      overCapacity: total > config.amountCents,
    })
  }

  // After the paycheck loop: apply any projected pushes dated after the last paycheck
  while (projPushPtr < projectedPushes.length) {
    applyProjectedPush(projectedPushes[projPushPtr])
    projPushPtr++
  }

  // Build account summaries
  const summaries: Record<string, AccountSummary> = {}
  for (const acc of accounts) {
    const progress = state.actualByAccount[acc.id] ?? 0
    const projectedOnly = sum(
      projectedPaychecks
        .filter(p => !p.isActual)
        .map(p => p.allocations[acc.id] ?? 0),
    )
    const projectedPushCents = projectedPushByAccount[acc.id] ?? 0
    const total = progress + projectedOnly + projectedPushCents
    let status: AccountSummary['status']
    if (acc.status === 'closed') status = 'closed'
    else if (acc.bonus.targetCents === 0) status = 'completed'
    else if (progress >= acc.bonus.targetCents) status = 'completed'
    else if (cmp(today, acc.bonus.deadlineDate) > 0) status = 'missed'
    else if (total >= acc.bonus.targetCents) status = 'on-track'
    else status = 'will-miss'

    const startCheck = acc.bonus.startDate ?? acc.openedDate
    if (cmp(today, startCheck) < 0 && status !== 'completed' && status !== 'missed' && status !== 'will-miss') status = 'pre-start'

    summaries[acc.id] = {
      accountId: acc.id,
      progressCents: progress,
      projectedCents: projectedOnly,
      projectedPushCents,
      totalCents: total,
      targetCents: acc.bonus.targetCents,
      status,
      projectedCompletionDate: projectedCompletion[acc.id],
      shortfallCents:
        status === 'will-miss' ? acc.bonus.targetCents - total : undefined,
      deadlineDate: acc.bonus.deadlineDate,
      remainingPaychecksInWindow: paychecksRemainingInWindow(
        cmp(today, acc.bonus.startDate ?? acc.openedDate) >= 0
          ? today
          : acc.bonus.startDate ?? acc.openedDate,
        acc.bonus.deadlineDate,
        paycheckDates,
      ),
    }
  }

  return { paychecks: projectedPaychecks, pushes, accounts: summaries }
}

export interface FeasibilityResult {
  feasible: boolean
  forecast: ForecastResult
  shortfalls: { accountId: string; shortfallCents: Cents; deadlineDate: DateStr }[]
}

export function feasibility(
  input: AllocatorInput & { proposed: Account },
): FeasibilityResult {
  const all = [...input.accounts, input.proposed]
  const fc = forecast({ ...input, accounts: all })
  const shortfalls = Object.values(fc.accounts)
    .filter(s => s.status === 'will-miss')
    .map(s => ({
      accountId: s.accountId,
      shortfallCents: s.shortfallCents ?? 0,
      deadlineDate: s.deadlineDate,
    }))
  return { feasible: shortfalls.length === 0, forecast: fc, shortfalls }
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}
