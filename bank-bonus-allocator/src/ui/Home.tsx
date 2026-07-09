// Single-page app: capacity hero → example banner → alerts → forecast grid
// → bonuses+add → external pushes → footer.
// Modals: About, Settings (incl. Today), Next paycheck, Bonus breakdown.
import { useEffect, useMemo, useReducer, useState } from 'react'
import { forecast } from '../model/allocator'
import { dispatch as coreDispatch } from '../core/reducer'
import type { Action } from '../core/actions'
import type { AppState } from '../core/state'
import { load, save, loadExample, saveExample, loadToday, saveToday, resetToday } from '../storage'
import { Grid } from './Grid'
import { SEED_SCENARIOS, seedScenario } from './seed'
import { accountAlerts } from './alerts'
import { nextPaycheckSplit } from './nextPaycheck'
import { fmtDollars, fromCents, toCents } from '../money'
import { AlertBanner, ExternalPushesSection, NextPaycheckCard } from './sections'
import { BonusList } from './BonusList'
import { BonusBreakdown } from './BonusBreakdown'
import { freeOverHorizon, roomForBonuses, TYPICAL_BONUS_CENTS } from './capacity'
import { Modal } from './Modal'
import { STATUS_INFO } from './status'

// ---------------------------------------------------------------------------
// Initial state — auto-loads seed when localStorage empty.
// today is PERSISTED so StrictMode's mount→save→remount cycle doesn't drift
// example data to the live date and hide the Grid.
// ---------------------------------------------------------------------------
function getInitial() {
  const loaded = load()
  if (loaded.accounts.length === 0) {
    const s = seedScenario()
    return {
      appState: { config: s.config, accounts: s.accounts, events: s.events } as AppState,
      today: s.today,
      isExampleData: true,
    }
  }
  return {
    appState: loaded,
    today: loadToday() ?? new Date().toISOString().slice(0, 10),
    isExampleData: loadExample(),
  }
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------
export function Home() {
  const [initial] = useState(getInitial)
  const [state, dispatch] = useReducer(coreDispatch, initial.appState)
  const [today, setToday] = useState(initial.today)
  const [isExampleData, setIsExampleData] = useState(initial.isExampleData)
  const [seedIdx, setSeedIdx] = useState(0)
  const [pushPrefill, setPushPrefill] = useState<{ date: string; targetAccountId: string; amount: string } | null>(null)

  // Modals
  const [aboutOpen, setAboutOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [nextPaycheckOpen, setNextPaycheckOpen] = useState(false)
  const [breakdownAccountId, setBreakdownAccountId] = useState<string | null>(null)

  const debug = new URLSearchParams(location.search).get('debug') === 'true'

  // Persist state + metadata
  useEffect(() => { save(state) }, [state])
  useEffect(() => { saveExample(isExampleData) }, [isExampleData])
  useEffect(() => { saveToday(today) }, [today])

  const fc = useMemo(
    () => forecast({ accounts: state.accounts, config: state.config, events: state.events, today }),
    [state, today],
  )

  const alerts = useMemo(() => accountAlerts(fc, state.accounts, state.config), [fc, state.accounts, state.config])
  const nextSplit = useMemo(() => nextPaycheckSplit(fc, today, state.accounts), [fc, today, state.accounts])

  // Show grid/alerts whenever there are non-closed accounts
  const hasAccounts = state.accounts.filter(a => a.status !== 'closed').length > 0

  // Capacity numbers
  const totalFree = freeOverHorizon(fc)
  const projectedPaychecks = fc.paychecks.filter(p => !p.isActual)
  const projectedCount = projectedPaychecks.length
  const avgFreePerCheck = projectedCount > 0 ? totalFree / projectedCount : 0
  const roomEstimate = roomForBonuses(fc, TYPICAL_BONUS_CENTS)
  const activeCount = state.accounts.filter(a => a.status === 'active').length

  // Next paycheck date for sparkline highlight
  const nextPaycheckDate = projectedPaychecks.find(p => p.date >= today)?.date

  const handleDispatch = (action: Action) => {
    if (action.kind === 'LoadSeed') setToday(action.today)
    dispatch(action)
  }

  const onReset = () => {
    if (!confirm('Clear all data?')) return
    dispatch({ kind: 'Reset' })
    const live = new Date().toISOString().slice(0, 10)
    setToday(live)
    resetToday()
    setIsExampleData(false)
    setSettingsOpen(false)
  }

  const onLoadSeed = () => {
    const scenario = SEED_SCENARIOS[seedIdx]
    if (!scenario) return
    if (state.accounts.length > 0 && !confirm(`Replace existing data with "${scenario.label}" scenario?`)) return
    const s = scenario.load()
    handleDispatch({ kind: 'LoadSeed', state: { config: s.config, accounts: s.accounts, events: s.events }, today: s.today })
  }

  const onStartFresh = () => {
    dispatch({ kind: 'Reset' })
    const live = new Date().toISOString().slice(0, 10)
    setToday(live)
    resetToday()
    setIsExampleData(false)
  }

  const onWriteOff = (accountId: string) => {
    const acc = state.accounts.find(a => a.id === accountId)
    if (!acc) return
    dispatch({ kind: 'EditAccount', account: { ...acc, status: 'closed' } })
  }

  const onAddExternalPush = (accountId: string, deadlineDate: string, amountCents: number) => {
    setPushPrefill({ date: deadlineDate, targetAccountId: accountId, amount: fromCents(amountCents) })
  }

  // Breakdown modal account
  const breakdownAccount = breakdownAccountId ? state.accounts.find(a => a.id === breakdownAccountId) : null
  const breakdownSummary = breakdownAccountId ? fc.accounts[breakdownAccountId] : null

  return (
    <div className="app">

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Bank Bonus Allocator</h2>
        <div className="row" style={{ gap: 8 }}>
          <button onClick={() => setAboutOpen(true)} style={{ fontSize: 13 }}>About ℹ</button>
          <button onClick={() => setSettingsOpen(true)} style={{ fontSize: 13 }}>Settings ⚙</button>
        </div>
      </div>

      {/* ── Capacity hero ── */}
      <div className="panel" style={{ borderLeft: '3px solid var(--accent)' }}>
        <div className="muted" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Your capacity</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
          ~{fmtDollars(totalFree)} free over your next {projectedCount} paychecks
        </div>
        <div className="muted" style={{ marginBottom: projectedCount > 0 ? 10 : 0 }}>
          ~{fmtDollars(avgFreePerCheck)}/check ·{' '}
          room for roughly{' '}
          <strong style={{ color: 'var(--accent)' }}>{roomEstimate}</strong>{' '}
          more typical bonuses ({fmtDollars(TYPICAL_BONUS_CENTS)} each)
          {activeCount > 0 && ` · ${activeCount} currently running`}
        </div>
        {projectedCount > 0 && (
          <>
            <div className="sparkline">
              {projectedPaychecks.map(p => {
                const pct = Math.max(0, Math.min(1, p.freeCents / state.config.amountCents))
                const barCls = pct < 0.05 ? 'over' : pct < 0.2 ? 'tight' : ''
                const isNext = p.date === nextPaycheckDate
                return (
                  <div key={p.date} className={`sparkline-col${isNext ? ' next' : ''}`}>
                    <div className="bar-area">
                      <div
                        className={`bar ${barCls}`}
                        style={{ height: `${Math.max(2, Math.round(pct * 100))}%` }}
                        title={`${p.date}: ${fmtDollars(p.freeCents)} free`}
                      />
                    </div>
                    <div className="bar-label">{fmtDollars(p.freeCents, { compact: true })}</div>
                  </div>
                )
              })}
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              ↑ free capacity per upcoming paycheck · next paycheck highlighted
            </div>
          </>
        )}
      </div>

      {/* ── Example-data banner (always fully visible when active) ── */}
      {isExampleData && (
        <div className="panel" style={{ background: 'var(--bg-alt)', borderLeft: '3px solid var(--accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>📋 <strong>Example data</strong> — names like "Citibonk" are made up. Explore freely; nothing is saved to any server.</span>
          <button className="primary" onClick={onStartFresh}>Start fresh →</button>
        </div>
      )}

      {/* ── Alerts ── */}
      {hasAccounts && alerts.length > 0 && (
        <AlertBanner
          alerts={alerts}
          accounts={state.accounts}
          today={today}
          onWriteOff={onWriteOff}
          onAddExternalPush={onAddExternalPush}
          dispatch={dispatch}
          fc={fc}
        />
      )}

      {/* ── Forecast grid ── */}
      {hasAccounts && (
        <Grid
          state={state}
          dispatch={handleDispatch}
          forecast={fc}
          today={today}
          onNextPaycheck={nextSplit ? () => setNextPaycheckOpen(true) : undefined}
          onAccountClick={id => setBreakdownAccountId(id)}
        />
      )}

      {/* ── Your bonuses + Add a bonus (embedded in BonusList panel) ── */}
      <BonusList
        accounts={state.accounts}
        config={state.config}
        events={state.events}
        forecast={fc}
        today={today}
        dispatch={dispatch}
        onShowBreakdown={id => setBreakdownAccountId(id)}
      />

      {/* ── External pushes ── */}
      <ExternalPushesSection
        accounts={state.accounts}
        events={state.events}
        dispatch={dispatch}
        prefill={pushPrefill}
        onPrefillConsumed={() => setPushPrefill(null)}
      />

      {/* ── Footer ── */}
      <div className="muted" style={{ fontSize: 11, marginTop: 20, textAlign: 'center', lineHeight: 1.8 }}>
        💾 All data stays in this browser (localStorage) — nothing is uploaded.
        <br />
        Built by{' '}
        <a href="https://kevinquinn.fun" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>kevinquinn.fun</a>
        {' · '}
        <a href="mailto:kevinquinnfun@notxss.anonaddy.com" style={{ color: 'inherit' }}>Send feedback</a>
      </div>

      {/* ══ About modal ══ */}
      <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} title="About this tool">

        <h4 style={{ marginTop: 0 }}>Why use this?</h4>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.7 }}>
          When you're juggling 2–3 <a href="https://www.doctorofcredit.com/best-bank-account-bonuses/" target="_blank" rel="noopener noreferrer"> bank bonuses</a> at once, it's hard to know: do you have the paycheck capacity to take on another
          one <em>(OR MORE!)</em> without missing an existing deadline?
        </p>

        <p style={{ fontWeight: 'bold', fontSize: 13, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.7 }}>
          If this tool isn't helping you increase the number of banks you feel comfortable churning at once, then I'm not accomplishing my goal.
        </p>
        
        <h4>How it works</h4>
        
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.7 }}>
          This tool splits your paychecks optimally across your open bonuses — soonest deadline first
          — and shows you exactly how much capacity you have left. Try out that new bonus you've been eyeing, and see the live impact on your existing ones before committing.
        </p>
        
        <ol style={{ paddingLeft: 20, lineHeight: 1.8, margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
          <li>Open <strong style={{ color: 'var(--text)' }}>Settings ⚙</strong> and enter your paycheck amount, cadence, and next date.</li>
          <li>Add each bank bonus you're chasing — target spend and deadline — using <strong style={{ color: 'var(--text)' }}>+ Add a bonus</strong>.</li>
          <li>The <strong style={{ color: 'var(--text)' }}>Forecast grid</strong> shows how your paychecks will be split. "Next" highlights the one coming up.</li>
          <li>After each paycheck lands, click its date in the grid to mark it as actual — the rest of the forecast re-runs.</li>
          <li>Try a hypothetical bonus with <strong style={{ color: 'var(--text)' }}>+ Add a bonus</strong> to see live feasibility before committing.</li>
          <li>Add a <strong style={{ color: 'var(--text)' }}>planned ACH push</strong> from another bank to cover a shortfall — it counts in the forecast immediately.</li>
        </ol>

        <h4>Status guide</h4>
        <div style={{ marginBottom: 16 }}>
          {Object.entries(STATUS_INFO).map(([s, desc]) => {
            const isBad = s === 'will-miss' || s === 'missed'
            const isGood = s === 'on-track' || s === 'completed'
            const cls = isGood ? 'good' : isBad ? 'bad' : 'muted'
            return (
              <div key={s} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'flex-start', marginBottom: 8 }}>
                <span className={cls} style={{ flexShrink: 0, fontWeight: 500 }}>{s}</span>
                <span style={{ color: 'var(--muted)', fontSize: 13, flex: '1 1 200px' }}>{desc}</span>
              </div>
            )
          })}
        </div>

        <h4>FAQ</h4>
        <dl style={{ fontSize: 13, lineHeight: 1.7, margin: '0 0 16px' }}>
          <dt style={{ fontWeight: 600 }}>Is my data private?</dt>
          <dd style={{ marginLeft: 0, color: 'var(--muted)', marginBottom: 8 }}>
            Yes — everything stays in your browser's localStorage. Nothing is sent to any server.
          </dd>
          <dt style={{ fontWeight: 600 }}>What's an ACH push / external push?</dt>
          <dd style={{ marginLeft: 0, color: 'var(--muted)', marginBottom: 8 }}>
            A manual ACH transfer you push in from another bank (e.g. Ally, Marcus) to help hit a
            spending target when your paycheck alone won't cover the shortfall in time.{' '}
            <a href="https://www.doctorofcredit.com/knowledge-base/list-methods-banks-count-direct-deposits/" target="_blank" rel="noopener noreferrer">
              Which transfers count as a direct deposit?
            </a>
          </dd>
          <dt style={{ fontWeight: 600 }}>How does it decide the splits?</dt>
          <dd style={{ marginLeft: 0, color: 'var(--muted)', marginBottom: 8 }}>
            Greedy, earliest-deadline-first: each paycheck funds the account with the tightest
            deadline first, then the next-tightest, until the paycheck is used up.
          </dd>
          <dt style={{ fontWeight: 600 }}>Is this financial advice?</dt>
          <dd style={{ marginLeft: 0, color: 'var(--muted)', marginBottom: 8 }}>
            No, it's a personal planning tool. Always double-check bonus terms with your bank
            before opening an account. I'll help you do the math, but at the end of the day it's on you to not be an idiot.
          </dd>
        </dl>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 13, color: 'var(--muted)' }}>
          Built by{' '}
          <a href="https://kevinquinn.fun" target="_blank" rel="noopener noreferrer">kevinquinn.fun</a>.
          {' '}Questions or feedback?{' '}
          <a href="mailto:kevinquinnfun@notxss.anonaddy.com">kevinquinnfun@notxss.anonaddy.com</a>
        </div>
      </Modal>

      {/* ══ Settings modal ══ */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label>
              Today (time-travel for testing)
              <input type="date" value={today} onChange={e => setToday(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
            </label>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Paycheck settings</div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <label>
                Paycheck $
                <input type="number" value={fromCents(state.config.amountCents)} onChange={e => handleDispatch({ kind: 'SetPaycheckConfig', config: { ...state.config, amountCents: toCents(e.target.value) } })} style={{ display: 'block', marginTop: 4 }} />
              </label>
              <label>
                Next paycheck date
                <input type="date" value={state.config.nextDate} onChange={e => handleDispatch({ kind: 'SetPaycheckConfig', config: { ...state.config, nextDate: e.target.value } })} style={{ display: 'block', marginTop: 4 }} />
              </label>
              <label>
                <span title="Calendar days between paychecks (14 = biweekly, 7 = weekly)">Cadence (days)</span>
                <input type="number" value={state.config.cadenceDays} onChange={e => handleDispatch({ kind: 'SetPaycheckConfig', config: { ...state.config, cadenceDays: parseInt(e.target.value || '14') } })} style={{ display: 'block', marginTop: 4 }} />
              </label>
              <label>
                <span title="How many future paychecks to project">Horizon (paychecks)</span>
                <input type="number" value={state.config.horizonPaychecks} onChange={e => handleDispatch({ kind: 'SetPaycheckConfig', config: { ...state.config, horizonPaychecks: parseInt(e.target.value || '10') } })} style={{ display: 'block', marginTop: 4 }} />
              </label>
            </div>
          </div>
          {debug && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Debug: load scenario</div>
              <div className="row" style={{ gap: 8 }}>
                <select value={seedIdx} onChange={e => setSeedIdx(Number(e.target.value))}>
                  {SEED_SCENARIOS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                </select>
                <button onClick={onLoadSeed}>Load</button>
              </div>
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <button className="danger" style={{ fontSize: 12 }} onClick={onReset}>Clear all data</button>
          </div>
        </div>
      </Modal>

      {/* ══ Next paycheck modal ══ */}
      {nextSplit && (
        <Modal open={nextPaycheckOpen} onClose={() => setNextPaycheckOpen(false)} title={`Next paycheck — ${nextSplit.date}`}>
          <NextPaycheckCard
            split={nextSplit}
            accounts={state.accounts}
            fc={fc}
            today={today}
            dispatch={handleDispatch}
          />
        </Modal>
      )}

      {/* ══ Bonus breakdown modal ══ */}
      {breakdownAccount && breakdownSummary && (
        <Modal
          open={!!breakdownAccountId}
          onClose={() => setBreakdownAccountId(null)}
          title={`${breakdownAccount.name} — how the math works`}
        >
          <BonusBreakdown
            account={breakdownAccount}
            summary={breakdownSummary}
            fc={fc}
            events={state.events}
          />
        </Modal>
      )}
    </div>
  )
}
