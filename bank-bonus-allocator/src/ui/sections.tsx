// Shared section components used by Home: settings, external pushes, paycheck history.
import { useEffect, useState } from 'react'
import type { Account, ExternalPushEvent, OverrideEvent } from '../model/types'
import type { Action } from '../core/actions'
import type { AppState } from '../core/state'
import type { ForecastResult } from '../model/allocator'
import type { AccountAlert } from './alerts'
import { nextPaycheckSplit, splitAsText } from './nextPaycheck'
import { fmtDollars, fromCents, toCents } from '../money'
import { diffDays } from '../model/dates'

// ---------------------------------------------------------------------------
// Alert banner
// ---------------------------------------------------------------------------
interface AlertBannerProps {
  alerts: AccountAlert[]
  accounts: Account[]
  today: string
  onWriteOff: (accountId: string) => void
  onAddExternalPush: (accountId: string, deadlineDate: string, amountCents: number) => void
  dispatch: (action: Action) => void
  fc: ForecastResult
}

export function AlertBanner({ alerts, today, onWriteOff, onAddExternalPush, dispatch, fc }: AlertBannerProps) {
  return (
    <div className="panel" style={{ borderLeft: '3px solid var(--bad)' }}>
      {alerts.map(alert => {
        const days = diffDays(alert.deadlineDate, today)
        if (alert.kind === 'missed') {
          return (
            <div key={alert.accountId} className="row" style={{ marginBottom: 6 }}>
              <span className="bad">⚠</span>
              <span><strong>{alert.accountName}</strong> deadline passed.</span>
              <button title="Mark this bonus as closed and stop tracking it" onClick={() => onWriteOff(alert.accountId)}>Mark as closed</button>
            </div>
          )
        }
        if (alert.kind === 'recoverable') {
          return (
            <div key={alert.accountId} className="row" style={{ marginBottom: 6 }}>
              <span className="bad">⚠</span>
              <span><strong>{alert.accountName}</strong> is at risk — deadline in {days}d with {fmtDollars(alert.shortfallCents)} remaining.</span>
              <button
                title="Zero out future allocations for this account so others can absorb the freed capacity"
                onClick={() => {
                  const futureDates = fc.paychecks.filter(p => !p.isActual && p.date >= today).map(p => p.date)
                  for (const date of futureDates) {
                    const ev: OverrideEvent = {
                      kind: 'Override',
                      id: 'ov-' + Math.random().toString(36).slice(2, 8),
                      date,
                      accountId: alert.accountId,
                      pinCents: 0,
                    }
                    dispatch({ kind: 'UpsertOverride', event: ev })
                  }
                }}>Skip this one</button>
            </div>
          )
        }
        // unrecoverable
        return (
          <div key={alert.accountId} className="row" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
            <span className="bad">⚠</span>
            <span><strong>{alert.accountName}</strong> cannot be saved by paycheck alone — needs an external push of {fmtDollars(alert.externalPushNeeded ?? 0)} by {alert.deadlineDate}, or write it off.</span>
            <button className="primary" title="Pre-fill an external push (money moved from another bank) to cover the shortfall" onClick={() => onAddExternalPush(alert.accountId, alert.deadlineDate, alert.externalPushNeeded ?? 0)}>Add external push</button>
            <button title="Close this bonus and stop tracking it (you can reopen it later from 'Bonuses at a glance')" onClick={() => onWriteOff(alert.accountId)}>Write it off</button>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Next paycheck card
// ---------------------------------------------------------------------------
interface NextPaycheckCardProps {
  split: NonNullable<ReturnType<typeof nextPaycheckSplit>>
  accounts: Account[]
  fc: ForecastResult
  today: string
  dispatch: (action: Action) => void
}

export function NextPaycheckCard({ split, dispatch }: NextPaycheckCardProps) {
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const upsertOverride = (accountId: string, cents: number) => {
    const ev: OverrideEvent = {
      kind: 'Override',
      id: 'ov-' + Math.random().toString(36).slice(2, 8),
      date: split.date,
      accountId,
      pinCents: cents,
    }
    dispatch({ kind: 'UpsertOverride', event: ev })
  }

  const onCopy = () => {
    const text = `Next paycheck: ${fmtDollars(split.totalCents)} on ${split.date}\n` + splitAsText(split)
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Next paycheck: {fmtDollars(split.totalCents)} on {split.date}</h3>
        <button onClick={onCopy} style={{ marginLeft: 'auto' }} title="Copy split as plain text to paste anywhere">{copied ? '✓ Copied' : 'Copy as text'}</button>
      </div>
      <table>
        <tbody>
          {split.perAccount.map(a => (
            <tr key={a.id}>
              <td style={{ paddingRight: 16, fontWeight: 500 }}>{a.name}</td>
              <td>
                {editing?.id === a.id ? (
                  <input
                    autoFocus
                    style={{ width: 80 }}
                    value={editing.value}
                    onChange={e => setEditing({ id: a.id, value: e.target.value })}
                    onBlur={() => { upsertOverride(a.id, toCents(editing.value)); setEditing(null) }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { upsertOverride(a.id, toCents(editing.value)); setEditing(null) }
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                ) : (
                  <span
                    style={{ cursor: 'pointer' }}
                    title="Click to override this allocation"
                    onClick={() => setEditing({ id: a.id, value: fromCents(a.cents) })}
                  >
                    {fmtDollars(a.cents)}
                  </span>
                )}
              </td>
            </tr>
          ))}
          <tr style={{ borderTop: '1px solid var(--border)' }}>
            <td style={{ paddingRight: 16, color: 'var(--muted)' }} title="Paycheck remainder after all allocations">Free</td>
            <td className="muted">{fmtDollars(split.freeCents)}</td>
          </tr>
        </tbody>
      </table>
      <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
        Update your direct deposit to match whenever this split changes. New accounts may take one pay cycle to appear.
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// External pushes section
// ---------------------------------------------------------------------------
interface ExternalPushesProps {
  accounts: Account[]
  events: AppState['events']
  dispatch: (action: Action) => void
  prefill: { date: string; targetAccountId: string; amount: string } | null
  onPrefillConsumed: () => void
}

export function ExternalPushesSection({ accounts, events, dispatch, prefill, onPrefillConsumed }: ExternalPushesProps) {
  const pushes = events.filter((e): e is ExternalPushEvent => e.kind === 'ExternalPush')
  const defaultDraft = (): { date: string; sourceLabel: string; targetAccountId: string; amount: string; status: 'actual' | 'projected' } => ({
    date: new Date().toISOString().slice(0, 10),
    sourceLabel: 'Ally',
    targetAccountId: accounts[0]?.id ?? '',
    amount: '500',
    status: 'projected',
  })
  const [draft, setDraft] = useState(defaultDraft)

  useEffect(() => {
    if (!prefill) return
    setDraft(d => ({
      ...d,
      date: prefill.date,
      targetAccountId: prefill.targetAccountId,
      amount: prefill.amount,
    }))
    onPrefillConsumed()
  }, [prefill])

  return (
    <div className="panel">
      <h3>External pushes / ACH pushes ({pushes.length})</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
        An ACH push is a manual transfer you push in from another bank (e.g. Ally, Marcus, a savings account)
        that counts toward a bonus's spending target — useful when a paycheck alone won't cover a shortfall in time.{' '}
        <a href="https://www.doctorofcredit.com/knowledge-base/list-methods-banks-count-direct-deposits/" target="_blank" rel="noopener noreferrer">
          Which transfers count as a direct deposit?
        </a>
      </div>
      <div className="muted" style={{ fontSize: 11, marginBottom: 10 }}>
        <strong>Planned</strong> pushes count toward your bonus projections right away — the forecast updates as if the transfer is already done. Mark as <strong>done</strong> once you've actually sent it.
      </div>
      {pushes.map(p => (
        <div key={p.id} className="row" style={{ marginBottom: 4 }}>
          <span style={{ width: 90 }}>{p.date}</span>
          <span style={{ width: 80 }}>{p.sourceLabel}</span>
          <span>→ {accounts.find(a => a.id === p.targetAccountId)?.name ?? p.targetAccountId}</span>
          <span>{fmtDollars(p.amountCents)}</span>
          <span className={p.status === 'actual' ? 'good' : 'muted'}>{p.status === 'actual' ? 'done' : 'planned'}</span>
          <button className="danger" onClick={() => dispatch({ kind: 'RemoveExternalPush', eventId: p.id })}>×</button>
        </div>
      ))}
      <div className="row" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
        <input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
        <input style={{ width: 80 }} placeholder="From (e.g. Ally)" value={draft.sourceLabel} onChange={e => setDraft({ ...draft, sourceLabel: e.target.value })} />
        <select value={draft.targetAccountId} onChange={e => setDraft({ ...draft, targetAccountId: e.target.value })}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input type="number" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} />
        <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as 'actual' | 'projected' })}>
          <option value="projected">planned (counts in forecast)</option>
          <option value="actual">done (already sent)</option>
        </select>
        <button
          className="primary"
          disabled={!draft.targetAccountId}
          onClick={() => {
            const e: ExternalPushEvent = {
              kind: 'ExternalPush',
              id: 'push-' + Math.random().toString(36).slice(2, 8),
              date: draft.date,
              status: draft.status,
              sourceLabel: draft.sourceLabel,
              targetAccountId: draft.targetAccountId,
              amountCents: toCents(draft.amount),
            }
            dispatch({ kind: 'AddExternalPush', event: e })
          }}
        >+ Add push</button>
      </div>
    </div>
  )
}
