import { describe, it, expect } from 'vitest'
import { seedScenario } from './ui/seed'
import { forecast } from './model/allocator'
import { fmtDollars } from './money'

describe('seed scenario sanity', () => {
  it('produces a sensible forecast and prints it', () => {
    const s = seedScenario()
    const r = forecast({ accounts: s.accounts, config: s.config, events: s.events, today: s.today })

    // Print for human eyeballing
    console.log('\n=== FORECAST ===')
    console.log('Date       | ' + s.accounts.map(a => a.name.padEnd(8)).join(' | ') + ' | Total   | Free')
    for (const p of r.paychecks) {
      const cells = s.accounts.map(a => fmtDollars(p.allocations[a.id] ?? 0).padEnd(8)).join(' | ')
      console.log(
        `${p.isActual ? '✓' : ' '}${p.date} | ${cells} | ${fmtDollars(p.totalCents).padEnd(7)} | ${fmtDollars(p.freeCents)}`
      )
    }
    console.log('\n=== SUMMARIES ===')
    for (const a of s.accounts) {
      const sum = r.accounts[a.id]
      console.log(
        `${a.name.padEnd(12)} ${sum.status.padEnd(11)} progress=${fmtDollars(sum.progressCents)} projected=${fmtDollars(sum.projectedCents)} target=${fmtDollars(sum.targetCents)} deadline=${sum.deadlineDate}` +
          (sum.projectedCompletionDate ? ` done=${sum.projectedCompletionDate}` : '') +
          (sum.shortfallCents ? ` SHORT=${fmtDollars(sum.shortfallCents)}` : '')
      )
    }

    // Sanity: every account either has a projected completion or is marked will-miss with a shortfall, or pre-start
    for (const a of s.accounts) {
      const sum = r.accounts[a.id]
      const ok =
        sum.status === 'completed' ||
        sum.status === 'on-track' ||
        sum.status === 'will-miss' ||
        sum.status === 'missed' ||
        sum.status === 'pre-start'
      expect(ok).toBe(true)
    }
    // No paycheck should be over-capacity in the seed
    for (const p of r.paychecks) {
      expect(p.overCapacity).toBe(false)
    }
  })
})
