// Scenario form for adding a new bonus: describe → see live verdict → commit.
import { useMemo, useState } from 'react'
import { feasibility, forecast } from '../model/allocator'
import type { Account, DateStr, Event, PaycheckConfig } from '../model/types'
import type { Action } from '../core/actions'
import { addDays, diffDays } from '../model/dates'
import { fmtDollars, toCents } from '../money'
import { nextPaycheckSplit } from './nextPaycheck'

interface Props {
  accounts: Account[]
  config: PaycheckConfig
  events: Event[]
  today: DateStr
  dispatch: (action: Action) => void
  onAdded?: () => void // called after the bonus is added (e.g. collapse the form)
}

export function AddBonus({ accounts, config, events, today, dispatch, onAdded }: Props) {
  const [name, setName] = useState('')
  const [targetStr, setTargetStr] = useState('')
  const [daysUntil, setDaysUntil] = useState(90)
  const [lag, setLag] = useState(false)
  const [openedStr, setOpenedStr] = useState(today)

  // Base forecast for upcoming paycheck dates
  const baseFC = useMemo(
    () => forecast({ accounts, config, events, today }),
    [accounts, config, events, today],
  )

  // First projected paycheck on/after the opened date — this is when the redirect can begin
  const upcomingDates = useMemo(
    () => baseFC.paychecks.filter(p => !p.isActual && p.date >= openedStr).map(p => p.date),
    [baseFC, openedStr],
  )

  const effectiveDeadline: DateStr = addDays(openedStr, daysUntil)
  // Lag = redirect won't apply until the paycheck after next (one cycle max)
  const effectiveStartDate: DateStr = (lag ? upcomingDates[1] : upcomingDates[0]) ?? upcomingDates[0] ?? openedStr

  const targetCents = toCents(targetStr)
  const hasProposed = targetCents > 0

  const proposed: Account | null = hasProposed
    ? {
        id: '__draft__',
        name: name.trim() || 'New bonus',
        openedDate: openedStr,
        status: 'active',
        bonus: {
          targetCents,
          deadlineDate: effectiveDeadline,
          startDate: effectiveStartDate,
        },
      }
    : null

  const feasResult = useMemo(() => {
    if (!proposed) return null
    return feasibility({ accounts, config, events, today, proposed })
  }, [accounts, config, events, today, proposed])

  // Verdict
  type Verdict = 'fits' | 'squeezes' | 'short'
  let verdict: Verdict | null = null
  let squeezeNames: string[] = []
  let shortfallCents = 0

  if (feasResult && proposed) {
    const draftShortfall = feasResult.shortfalls.find(s => s.accountId === '__draft__')
    const existingShortfalls = feasResult.shortfalls.filter(s => s.accountId !== '__draft__')

    if (feasResult.feasible) {
      verdict = 'fits'
    } else if (!draftShortfall && existingShortfalls.length > 0) {
      verdict = 'squeezes'
      squeezeNames = existingShortfalls.map(s => accounts.find(a => a.id === s.accountId)?.name ?? s.accountId)
    } else {
      verdict = 'short'
      shortfallCents = draftShortfall?.shortfallCents ?? 0
    }
  }

  const allAccounts = proposed ? [...accounts, proposed] : accounts
  const draftNextSplit = feasResult?.forecast
    ? nextPaycheckSplit(feasResult.forecast, today, allAccounts)
    : null

  const onAddToTracker = () => {
    if (!proposed) return
    const newAccount: Account = {
      ...proposed,
      id: 'acc-' + Math.random().toString(36).slice(2, 8),
    }
    dispatch({ kind: 'AddAccount', account: newAccount })
    setName('')
    setTargetStr('')
    setDaysUntil(90)
    setLag(false)
    setOpenedStr(today)
    onAdded?.()
  }

  return (
    <div className="panel" style={{ borderLeft: '3px solid var(--accent)' }}>
      <h3 style={{ marginTop: 0 }}>Add a bonus</h3>

      {/* Form */}
      <div className="row" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <label>
          Name{' '}
          <input
            placeholder="e.g. Chase checking"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: 160 }}
          />
        </label>

        <label>
          Opened on{' '}
          <input
            type="date"
            value={openedStr}
            onChange={e => setOpenedStr(e.target.value || today)}
          />
        </label>

        <label>
          Target ${' '}
          <input
            type="number"
            placeholder="3000"
            value={targetStr}
            onChange={e => setTargetStr(e.target.value)}
            style={{ width: 80 }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Ends in{' '}
          <input
            type="number"
            value={daysUntil}
            min={1}
            max={730}
            onChange={e => setDaysUntil(Number(e.target.value) || 90)}
            style={{ width: 54 }}
          />{' '}
          days
          <span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>({effectiveDeadline})</span>
        </label>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={lag}
          onChange={e => setLag(e.target.checked)}
        />
        Payroll lags — redirect won't apply until the paycheck after next
        {lag && upcomingDates[1] && (
          <span className="muted" style={{ fontSize: 11 }}>(starts {upcomingDates[1]})</span>
        )}
      </label>

      {!hasProposed && (
        <div className="muted" style={{ fontSize: 13 }}>Enter a target amount to see if it fits ↑</div>
      )}

      {/* Live result */}
      {feasResult && proposed && verdict && (
        <>
          {/* Verdict card */}
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderLeft: `3px solid ${
                verdict === 'fits' ? 'var(--good)' : verdict === 'squeezes' ? 'var(--warn)' : 'var(--bad)'
              }`,
              background: 'var(--bg-alt)',
              borderRadius: 4,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
              {verdict === 'fits' && <><span className="good">✅ Fits</span> — you've got room for this one.</>}
              {verdict === 'squeezes' && <><span className="warn">⚠️ Fits, but squeezes</span> {squeezeNames.join(', ')}.</>}
              {verdict === 'short' && <><span className="bad">❌ Short ~{fmtDollars(shortfallCents)}</span> by {effectiveDeadline}.</>}
            </div>

            {verdict === 'short' && (
              <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
                Try a smaller target, a later deadline, or uncheck the payroll-lag option.
              </div>
            )}

            {/* Projected completion */}
            {feasResult.forecast.accounts['__draft__']?.projectedCompletionDate && verdict !== 'short' && (
              <div style={{ marginBottom: 8 }}>
                <span className="muted">Projected done: </span>
                <strong>{feasResult.forecast.accounts['__draft__'].projectedCompletionDate}</strong>
                {' '}
                <span className="muted">
                  ({diffDays(feasResult.forecast.accounts['__draft__'].projectedCompletionDate!, today)}d away)
                </span>
              </div>
            )}

            {/* Next paycheck split with draft */}
            {draftNextSplit && (
              <div>
                <div className="muted" style={{ marginBottom: 4, fontSize: 12 }}>
                  Next paycheck ({draftNextSplit.date}) — {fmtDollars(draftNextSplit.totalCents)} total:
                </div>
                <table style={{ maxWidth: 300 }}>
                  <tbody>
                    {draftNextSplit.perAccount
                      .filter(a => a.cents > 0)
                      .map(a => (
                        <tr key={a.id}>
                          <td style={{ paddingRight: 12, fontWeight: a.id === '__draft__' ? 600 : 400, color: a.id === '__draft__' ? 'var(--accent)' : undefined }}>
                            {a.id === '__draft__' ? `★ ${a.name}` : a.name}
                          </td>
                          <td style={{ color: a.id === '__draft__' ? 'var(--accent)' : undefined }}>
                            {fmtDollars(a.cents)}
                          </td>
                        </tr>
                      ))}
                    <tr style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="muted">Free</td>
                      <td className="muted">{fmtDollars(draftNextSplit.freeCents)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Impact on current bonuses */}
          {accounts.filter(a => a.status !== 'closed').length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Impact on current bonuses:</div>
              {accounts
                .filter(a => a.status !== 'closed')
                .map(acc => {
                  const before = baseFC.accounts[acc.id]
                  const after = feasResult.forecast.accounts[acc.id]
                  if (!before || !after) return null
                  const statusChanged = before.status !== after.status
                  const completionDelta =
                    before.projectedCompletionDate && after.projectedCompletionDate
                      ? diffDays(after.projectedCompletionDate, before.projectedCompletionDate)
                      : null
                  return (
                    <div key={acc.id} className="row" style={{ marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ minWidth: 120, fontWeight: 500 }}>{acc.name}</span>
                      {!statusChanged && (completionDelta === null || completionDelta === 0) && (
                        <span className="good" style={{ fontSize: 12 }}>✓ unaffected</span>
                      )}
                      {!statusChanged && completionDelta !== null && completionDelta > 0 && (
                        <span className="muted" style={{ fontSize: 12 }}>finishes +{completionDelta}d later</span>
                      )}
                      {!statusChanged && completionDelta !== null && completionDelta < 0 && (
                        <span className="good" style={{ fontSize: 12 }}>finishes {-completionDelta}d earlier</span>
                      )}
                      {statusChanged && (
                        <span className="bad" style={{ fontSize: 12 }}>⚠ {before.status} → {after.status}</span>
                      )}
                    </div>
                  )
                })}
            </div>
          )}

          {/* Add button — always shown so users can add and then tweak to make it work */}
          <div style={{ marginTop: 12 }}>
            <button className="primary" style={{ fontSize: 14, padding: '8px 20px' }} onClick={onAddToTracker}>
              Add "{proposed.name}" to my bonuses →
            </button>
            {verdict === 'squeezes' && (
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                This will tighten {squeezeNames.join(', ')} — you can adjust in the edit form above.
              </div>
            )}
            {verdict === 'short' && (
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                Adding anyway is fine — adjust paychecks or add a planned external push to close the gap.
              </div>
            )}
            <div className="muted" style={{ marginTop: 6, fontSize: 11 }}>
              After adding, update your direct deposit to match the new split. New accounts may take one pay cycle to appear.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
