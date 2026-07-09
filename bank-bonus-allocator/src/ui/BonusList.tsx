// Merged bonus cards + "Add a bonus" form — all in one panel.
// Status tooltips from STATUS_INFO; status guide is in the About modal.
import { useState } from 'react'
import type { Account, Event, PaycheckConfig } from '../model/types'
import type { ForecastResult } from '../model/allocator'
import type { Action } from '../core/actions'
import { fmtDollars, fromCents, toCents } from '../money'
import { diffDays } from '../model/dates'
import { statusClass, STATUS_INFO } from './status'
import { validateAccount } from './validate'
import { AddBonus } from './AddBonus'

interface Props {
  accounts: Account[]
  config: PaycheckConfig
  events: Event[]
  forecast: ForecastResult
  today: string
  dispatch: (action: Action) => void
  onShowBreakdown?: (accountId: string) => void
}

export function BonusList({ accounts, config, events, forecast, today, dispatch, onShowBreakdown }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const active = accounts.filter(a => a.status !== 'closed')
  const closed = accounts.filter(a => a.status === 'closed')

  return (
    <div className="panel">
      <h3>Your bonuses</h3>
      {active.length === 0 && (
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>No active bonuses yet — add one below to see how it fits into your budget.</div>
      )}
      {active.map(a => {
        const s = forecast.accounts[a.id]
        if (!s) return null
        const days = diffDays(a.bonus.deadlineDate, today)
        const isEditing = editingId === a.id
        return (
          <div key={a.id} className="account-card">
            {/* Glance row */}
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              <strong style={{ minWidth: 100 }}>{a.name}</strong>
              <span className={statusClass(s.status)} title={STATUS_INFO[s.status]}>{s.status}</span>
              <span>{fmtDollars(s.totalCents)} / {fmtDollars(s.targetCents)}</span>
              {s.progressCents > 0 && s.progressCents !== s.totalCents && (
                <span className="muted" style={{ fontSize: 12 }}>({fmtDollars(s.progressCents)} actual)</span>
              )}
              <span className="muted">deadline in {days}d</span>
              {s.projectedCompletionDate && <span className="good">→ done {s.projectedCompletionDate}</span>}
              {s.shortfallCents ? <span className="bad">shortfall {fmtDollars(s.shortfallCents)}</span> : null}
              {onShowBreakdown && (
                <button
                  style={{ fontSize: 11, padding: '2px 6px' }}
                  onClick={() => onShowBreakdown(a.id)}
                  title="See how the math works out for this bonus"
                >
                  Details ▸
                </button>
              )}
              <button
                style={{ fontSize: 11, padding: '2px 6px', marginLeft: onShowBreakdown ? 0 : 'auto' }}
                onClick={() => setEditingId(isEditing ? null : a.id)}
              >
                {isEditing ? 'Done ▴' : 'Edit ▸'}
              </button>
            </div>
            {/* Inline edit form */}
            {isEditing && (
              <BonusEditRow
                account={a}
                dispatch={dispatch}
                onDone={() => setEditingId(null)}
              />
            )}
          </div>
        )
      })}

      {/* Written-off / Reopen */}
      {closed.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Written off:</div>
          {closed.map(a => (
            <div key={a.id} className="account-card" style={{ opacity: 0.6 }}>
              <div className="row">
                <strong style={{ minWidth: 100 }}>{a.name}</strong>
                <span className="muted">closed</span>
                <button
                  style={{ fontSize: 12 }}
                  title="Reopen this bonus and resume tracking"
                  onClick={() => dispatch({ kind: 'EditAccount', account: { ...a, status: 'active' } })}
                >Reopen</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add a bonus — toggle button + inline form, all inside this panel */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
        {!showAdd ? (
          <button className="primary" onClick={() => setShowAdd(true)}>+ Add a bonus</button>
        ) : (
          <>
            <AddBonus
              accounts={accounts}
              config={config}
              events={events}
              today={today}
              dispatch={dispatch}
              onAdded={() => setShowAdd(false)}
            />
            <button style={{ marginTop: 8, fontSize: 12 }} onClick={() => setShowAdd(false)}>▴ Close</button>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline edit form
// ---------------------------------------------------------------------------
function BonusEditRow({ account, dispatch, onDone }: {
  account: Account
  dispatch: (action: Action) => void
  onDone: () => void
}) {
  const [a, setA] = useState(account)
  const errors = validateAccount(a)

  const save = (updated: Account) => {
    setA(updated)
    dispatch({ kind: 'EditAccount', account: updated })
  }

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <label>Name <input style={{ width: 130 }} value={a.name} onChange={e => save({ ...a, name: e.target.value })} /></label>
        <label>Target $ <input type="number" style={{ width: 80 }} value={fromCents(a.bonus.targetCents)} onChange={e => save({ ...a, bonus: { ...a.bonus, targetCents: toCents(e.target.value) } })} /></label>
        <label>Deadline <input type="date" value={a.bonus.deadlineDate} onChange={e => save({ ...a, bonus: { ...a.bonus, deadlineDate: e.target.value } })} /></label>
        <label>Redirect starts <input type="date" value={a.bonus.startDate ?? a.openedDate} onChange={e => save({ ...a, bonus: { ...a.bonus, startDate: e.target.value } })} /></label>
        <label>Status{' '}
          <select value={a.status} onChange={e => save({ ...a, status: e.target.value as Account['status'] })}>
            <option value="active">active</option>
            <option value="completed">completed</option>
            <option value="closed">closed</option>
          </select>
        </label>
        <button className="danger" style={{ fontSize: 12 }} onClick={() => { if (confirm(`Delete "${a.name}"?`)) dispatch({ kind: 'RemoveAccount', accountId: a.id }) }}>Delete</button>
        <button style={{ fontSize: 12 }} onClick={onDone}>Done ✓</button>
      </div>
      {errors.length > 0 && (
        <div className="bad" style={{ fontSize: 12, marginTop: 4 }}>{errors.join(' · ')}</div>
      )}
    </div>
  )
}

