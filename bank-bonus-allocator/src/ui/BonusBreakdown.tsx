// Math breakdown modal for a single bonus account.
// Shows exactly what's counting toward the target: actual paycheck splits,
// actual external pushes, projected paycheck allocations, and planned pushes.
// This makes external pushes visible in the math — previously they changed
// the numbers silently.
import type { Account, Event, ExternalPushEvent, PaycheckSplitEvent } from '../model/types'
import type { AccountSummary, ForecastResult } from '../model/allocator'
import { fmtDollars } from '../money'
import { statusClass, STATUS_INFO } from './status'

interface Props {
  account: Account
  summary: AccountSummary
  fc: ForecastResult
  events: Event[]
}

export function BonusBreakdown({ account, summary, fc, events }: Props) {
  const id = account.id

  // Actuals: paycheck splits that allocated something to this account
  const actualPaychecks = events
    .filter((e): e is PaycheckSplitEvent => e.kind === 'PaycheckSplit' && e.status === 'actual')
    .filter(e => (e.allocations[id] ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Actuals: external pushes that targeted this account
  const actualPushes = events
    .filter((e): e is ExternalPushEvent => e.kind === 'ExternalPush' && e.status === 'actual' && e.targetAccountId === id)
    .sort((a, b) => a.date.localeCompare(b.date))

  const actualTotal = actualPaychecks.reduce((s, e) => s + (e.allocations[id] ?? 0), 0)
    + actualPushes.reduce((s, e) => s + e.amountCents, 0)

  // Projected: future paycheck allocations for this account
  const projectedPaychecks = fc.paychecks
    .filter(p => !p.isActual && (p.allocations[id] ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Projected: planned external pushes targeting this account
  const plannedPushes = events
    .filter((e): e is ExternalPushEvent => e.kind === 'ExternalPush' && e.status !== 'actual' && e.targetAccountId === id)
    .sort((a, b) => a.date.localeCompare(b.date))

  const projectedTotal = projectedPaychecks.reduce((s, p) => s + (p.allocations[id] ?? 0), 0)
    + plannedPushes.reduce((s, e) => s + e.amountCents, 0)

  const hasActuals = actualPaychecks.length > 0 || actualPushes.length > 0
  const hasProjected = projectedPaychecks.length > 0 || plannedPushes.length > 0

  const pct = Math.min(100, Math.round((summary.totalCents / Math.max(1, summary.targetCents)) * 100))

  const statusCls = statusClass(summary.status)

  // Plain-English summary line
  let summaryLine: string
  if (summary.status === 'completed') {
    summaryLine = `Completed on ${summary.projectedCompletionDate ?? '—'}.`
  } else if (summary.status === 'on-track') {
    summaryLine = summary.projectedCompletionDate
      ? `On track — projected done ${summary.projectedCompletionDate}.`
      : 'On track to meet the deadline.'
  } else if (summary.status === 'will-miss') {
    summaryLine = `Shortfall of ${fmtDollars(summary.shortfallCents ?? 0)} — consider adding a planned ACH push or adjusting paychecks.`
  } else if (summary.status === 'missed') {
    summaryLine = `Deadline has passed.`
  } else {
    summaryLine = `Status: ${summary.status}`
  }

  return (
    <div style={{ fontSize: 13, lineHeight: 1.7 }}>
      {/* Header: status + progress bar */}
      <div className="row" style={{ marginBottom: 8, gap: 8 }}>
        <span className={statusCls} title={STATUS_INFO[summary.status]}>{summary.status}</span>
        <span className="muted">{fmtDollars(summary.totalCents)} of {fmtDollars(summary.targetCents)}</span>
        {summary.shortfallCents ? <span className="bad">shortfall {fmtDollars(summary.shortfallCents)}</span> : null}
      </div>
      <div className="progress" style={{ marginBottom: 12 }}>
        <div style={{ width: pct + '%', background: summary.status === 'will-miss' || summary.status === 'missed' ? 'var(--bad)' : 'var(--good)' }} />
      </div>

      {/* Progress so far (actuals) */}
      {hasActuals && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Progress so far</div>
          {actualPaychecks.map(e => (
            <div key={e.id} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
              <span className="muted">{e.date}</span>
              <span className="muted">paycheck</span>
              <span className="good">+{fmtDollars(e.allocations[id] ?? 0)}</span>
            </div>
          ))}
          {actualPushes.map(e => (
            <div key={e.id} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
              <span className="muted">{e.date}</span>
              <span className="muted">ACH push from {e.sourceLabel}</span>
              <span className="good">+{fmtDollars(e.amountCents)}</span>
            </div>
          ))}
          {(actualPaychecks.length + actualPushes.length > 1) && (
            <div className="row" style={{ justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: 4, marginTop: 4 }}>
              <span>Subtotal</span>
              <span className="good">{fmtDollars(actualTotal)}</span>
            </div>
          )}
        </div>
      )}

      {/* Projected (future) */}
      {hasProjected && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Projected</div>
          {projectedPaychecks.map(p => (
            <div key={p.date} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
              <span className="muted">{p.date}</span>
              <span className="muted">paycheck</span>
              <span>+{fmtDollars(p.allocations[id] ?? 0)}</span>
            </div>
          ))}
          {plannedPushes.map(e => (
            <div key={e.id} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
              <span className="muted">{e.date}</span>
              <span className="muted">planned push from {e.sourceLabel}</span>
              <span style={{ color: 'var(--accent)' }}>+{fmtDollars(e.amountCents)}</span>
            </div>
          ))}
          {(projectedPaychecks.length + plannedPushes.length > 1) && (
            <div className="row" style={{ justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: 4, marginTop: 4 }}>
              <span>Subtotal</span>
              <span>{fmtDollars(projectedTotal)}</span>
            </div>
          )}
        </div>
      )}

      {!hasActuals && !hasProjected && (
        <div className="muted" style={{ marginBottom: 12 }}>No allocations yet.</div>
      )}

      {/* Bottom line */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>Total toward goal</span>
          <span style={{ fontWeight: 600 }}>{fmtDollars(summary.totalCents)} / {fmtDollars(summary.targetCents)}</span>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>{summaryLine}</div>
        {summary.status === 'will-miss' && plannedPushes.length === 0 && (
          <div className="muted" style={{ fontSize: 11, marginTop: 4, color: 'var(--accent)' }}>
            Tip: Add a planned ACH push below to close the gap — it'll update this forecast immediately.
          </div>
        )}
      </div>
    </div>
  )
}
