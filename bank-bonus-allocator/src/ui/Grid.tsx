import { useState } from 'react'
import type { Account, OverrideEvent, PaycheckSplitEvent } from '../model/types'
import type { ForecastResult } from '../model/allocator'
import type { Action } from '../core/actions'
import type { AppState } from '../core/state'
import { fmtDollars, fromCents, toCents } from '../money'
import { statusClass, statusColor } from './status'
import { displayedAccounts } from './grid-helpers'

interface Props {
  state: AppState
  dispatch: (action: Action) => void
  forecast: ForecastResult
  /** When provided: highlights the next projected paycheck row and shows "+ Add past paycheck" form. */
  today?: string
  /** When provided: shows a "Next paycheck ▸" button in the grid header that calls this. */
  onNextPaycheck?: () => void
  /** When provided: makes account column headers clickable (e.g. to open breakdown modal). */
  onAccountClick?: (accountId: string) => void
}

export function Grid({ state, dispatch, forecast, today, onNextPaycheck, onAccountClick }: Props) {
  const { accounts } = state
  const cols = displayedAccounts(accounts, forecast.paychecks)

  // First projected (non-actual) paycheck on or after today — highlighted as "next"
  const nextPaycheckDate = today
    ? forecast.paychecks.find(p => !p.isActual && p.date >= today)?.date
    : undefined

  return (
    <>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Forecast</h3>
          {onNextPaycheck && nextPaycheckDate && (
            <button className="primary" style={{ fontSize: 13 }} onClick={onNextPaycheck}>
              Next paycheck ▸
            </button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th className="date-col">Date</th>
                {cols.map(a => {
                  const s = forecast.accounts[a.id]
                  if (!s) return <th key={a.id}>{a.name}</th>
                  const pct = Math.min(100, (s.totalCents / Math.max(1, s.targetCents)) * 100)
                  const isClosed = a.status === 'closed'
                  return (
                    <th
                      key={a.id}
                      style={{ minWidth: 110, opacity: isClosed ? 0.55 : 1, cursor: onAccountClick ? 'pointer' : undefined }}
                      onClick={onAccountClick ? () => onAccountClick(a.id) : undefined}
                      title={onAccountClick ? 'Click to see math breakdown' : undefined}
                    >
                      <div>{a.name}{isClosed && <span className="muted" style={{ fontSize: 10 }}> (closed)</span>}</div>
                      <div className="muted">{fmtDollars(s.totalCents)}/{fmtDollars(s.targetCents)} by {a.bonus.deadlineDate}</div>
                      {s.progressCents > 0 && s.progressCents !== s.totalCents && (
                        <div className="muted" style={{ fontSize: 11 }}>{fmtDollars(s.progressCents)} actual</div>
                      )}
                      <div className="progress"><div style={{ width: pct + '%', background: statusColor(s.status) }} /></div>
                      <div className={'muted ' + statusClass(s.status)}>{s.status}{s.shortfallCents ? ` (−${fmtDollars(s.shortfallCents)})` : ''}</div>
                    </th>
                  )
                })}
                <th>Total</th>
                <th title="Paycheck remainder after all allocations">Free</th>
              </tr>
            </thead>
            <tbody>
              {forecast.paychecks.map(p => (
                <PaycheckRow
                  key={p.date}
                  paycheck={p}
                  accounts={cols}
                  dispatch={dispatch}
                  isNext={p.date === nextPaycheckDate}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          Click a cell to pin an override (📌). Press Delete or click ✕ to unpin. Click the date to mark a paycheck "actual".
          {' '}Update your direct deposit whenever the highlighted next-paycheck row changes.
        </div>

        {/* Add past paycheck form — only shown when today is provided (Home page) */}
        {today && (
          <AddPastPaycheckForm accounts={accounts} today={today} dispatch={dispatch} />
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Paycheck row
// ---------------------------------------------------------------------------
function PaycheckRow({
  paycheck,
  accounts,
  dispatch,
  isNext,
}: {
  paycheck: ForecastResult['paychecks'][number]
  accounts: Account[]
  dispatch: (action: Action) => void
  isNext?: boolean
}) {
  const [editing, setEditing] = useState<{ accId: string; value: string } | null>(null)

  const upsertOverride = (accId: string, cents: number | null) => {
    if (cents == null) {
      dispatch({ kind: 'ClearOverride', date: paycheck.date, accountId: accId })
      return
    }
    const ev: OverrideEvent = {
      kind: 'Override',
      id: 'ov-' + Math.random().toString(36).slice(2, 8),
      date: paycheck.date,
      accountId: accId,
      pinCents: cents,
    }
    dispatch({ kind: 'UpsertOverride', event: ev })
  }

  const promoteToActual = () => {
    const ev: PaycheckSplitEvent = {
      kind: 'PaycheckSplit',
      id: 'pc-' + Math.random().toString(36).slice(2, 8),
      date: paycheck.date,
      status: 'actual',
      allocations: paycheck.allocations,
    }
    dispatch({ kind: 'MarkPaycheckActual', event: ev })
  }

  const unmarkActual = () => {
    dispatch({ kind: 'UnmarkPaycheckActual', date: paycheck.date })
  }

  return (
    <tr style={isNext ? { borderLeft: '3px solid var(--accent)', background: 'var(--bg-alt)' } : undefined}>
      <td className="date-col">
        {paycheck.isActual ? (
          <span title="actual — click to unmark" onClick={unmarkActual} style={{ cursor: 'pointer' }}>
            ✓ {paycheck.date}
          </span>
        ) : (
          <span title="click to mark this projection as actual" onClick={promoteToActual} style={{ cursor: 'pointer' }}>
            {paycheck.date}
            {isNext && (
              <span style={{ color: 'var(--accent)', fontSize: 10, marginLeft: 4, fontWeight: 600 }}>next</span>
            )}
          </span>
        )}
      </td>
      {accounts.map(a => {
        const isClosed = a.status === 'closed'
        const v = paycheck.allocations[a.id] ?? 0
        const pinned = paycheck.pinnedAccountIds.has(a.id)
        if (isClosed) {
          return (
            <td key={a.id} className={paycheck.isActual ? 'actual' : ''} style={{ opacity: 0.55 }}>
              {v > 0 ? fmtDollars(v) : '—'}
            </td>
          )
        }
        const cls = [
          paycheck.isActual ? 'actual' : '',
          pinned ? 'pinned' : '',
          v === 0 ? 'zero' : '',
        ].join(' ')
        const isEditing = editing?.accId === a.id
        return (
          <td
            key={a.id}
            className={cls}
            style={{ cursor: paycheck.isActual ? 'default' : 'pointer' }}
            onClick={() => {
              if (paycheck.isActual) return
              if (!isEditing) setEditing({ accId: a.id, value: fromCents(v) })
            }}
          >
            {isEditing ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <input
                  autoFocus
                  style={{ width: 64 }}
                  value={editing!.value}
                  onChange={e => setEditing({ accId: a.id, value: e.target.value })}
                  onBlur={e => {
                    if ((e.relatedTarget as HTMLElement)?.dataset?.unpin) return
                    upsertOverride(a.id, toCents(editing!.value))
                    setEditing(null)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      upsertOverride(a.id, toCents(editing!.value))
                      setEditing(null)
                    }
                    if (e.key === 'Escape') setEditing(null)
                    if (e.key === 'Delete' || (e.key === 'Backspace' && editing!.value === '')) {
                      upsertOverride(a.id, null)
                      setEditing(null)
                    }
                  }}
                />
                {pinned && (
                  <button
                    data-unpin="1"
                    title="Remove pin"
                    style={{ padding: '0 3px', fontSize: 11, lineHeight: 1 }}
                    onMouseDown={e => { e.preventDefault(); upsertOverride(a.id, null); setEditing(null) }}
                  >✕</button>
                )}
              </span>
            ) : (
              <span title={pinned ? 'pinned — click to edit, Delete to unpin' : 'click to pin'}>
                {v === 0 ? '—' : fmtDollars(v)}{pinned && <span style={{ color: 'var(--accent)' }}> 📌</span>}
              </span>
            )}
          </td>
        )
      })}
      <td className={paycheck.overCapacity ? 'over' : ''}>{fmtDollars(paycheck.totalCents)}</td>
      <td className={paycheck.freeCents < 0 ? 'bad' : 'muted'} title="Paycheck remainder after all allocations">{fmtDollars(paycheck.freeCents)}</td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Add past paycheck form (folded into grid panel when today is provided)
// ---------------------------------------------------------------------------
function AddPastPaycheckForm({ accounts, today, dispatch }: {
  accounts: AppState['accounts']
  today: string
  dispatch: (action: Action) => void
}) {
  const active = accounts.filter(a => a.status !== 'closed')
  const blankAmounts = () => Object.fromEntries(active.map(a => [a.id, '']))
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today)
  const [amounts, setAmounts] = useState<Record<string, string>>(blankAmounts)

  if (!open) {
    return (
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
        <button style={{ fontSize: 12, color: 'var(--muted)' }} onClick={() => setOpen(true)}>+ Add past paycheck</button>
      </div>
    )
  }

  const onSave = () => {
    const allocations: Record<string, number> = {}
    for (const a of active) {
      const v = toCents(amounts[a.id] ?? '')
      if (v > 0) allocations[a.id] = v
    }
    if (Object.keys(allocations).length === 0) return
    const ev: PaycheckSplitEvent = {
      kind: 'PaycheckSplit',
      id: 'hist-' + Math.random().toString(36).slice(2, 8),
      date,
      status: 'actual',
      allocations,
    }
    dispatch({ kind: 'MarkPaycheckActual', event: ev })
    setAmounts(blankAmounts())
    setOpen(false)
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Record a past paycheck — it'll appear as an actual row in the forecast above:</div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        <label>Date <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        {active.map(a => (
          <label key={a.id}>{a.name} $
            <input
              type="number"
              style={{ width: 70 }}
              placeholder="0"
              value={amounts[a.id] ?? ''}
              onChange={e => setAmounts({ ...amounts, [a.id]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="primary" onClick={onSave} disabled={active.length === 0}>Save paycheck</button>
        <button onClick={() => { setOpen(false); setAmounts(blankAmounts()) }}>Cancel</button>
      </div>
    </div>
  )
}
