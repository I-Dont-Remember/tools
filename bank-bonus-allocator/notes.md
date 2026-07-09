# Notes — Bank Bonus Allocator

## 2026-06-24 — kickoff

Goal: replace the user's messy manual notes for tracking 3–6 simultaneous bank-account signup bonuses. Per the plan: event-sourced ledger + greedy allocator + grid UI, Vite/React/TS, localStorage.

### Design decisions made up-front

- **Event-sourced** so truth (actual deposits) and projections (planned splits) are structurally separated. `replay(events) → State` is the only state reader.
- **Allocator runs every render** rather than being persisted — projections are derived, only actuals/overrides/account-definitions persist. Avoids stale-projection bugs entirely.
- **Day granularity** for dates. Month/year not enough (paychecks are biweekly); time-of-day irrelevant.
- **Dates as `YYYY-MM-DD` strings**, not `Date` objects, in the model. Date math via small helpers. Avoids timezone foot-guns when round-tripping localStorage.
- **Money as integer cents** internally. UI converts to dollars at the edges. Avoids float drift.

### Greedy allocator sketch

For each future paycheck date (ascending):
1. Skip if a `PaycheckSplit { status: 'actual' }` already exists for that date — use it as-is.
2. Reserve any pinned `Override` amounts for that date, deducting from paycheck capacity.
3. For each active bonus where `startDate ≤ date ≤ deadline` and `progress < target`:
   - `paychecksRemaining = number of paychecks in (date, deadline]` (inclusive of `date`)
   - `requiredPace = ceil((target − progress) / paychecksRemaining)`
4. Sort eligible bonuses by `(deadline asc, requiredPace desc)`. Allocate `min(requiredPace, remaining)` to each in order.
5. After paycheck allocation, check fee-avoidance: for any account with `monthlyMin`, if the month-to-date deposits to it are below `monthlyMin` and this is the last paycheck of the month, top it up from `remaining` (or schedule an ExternalPush if no capacity).
6. Emit `PaycheckSplit { status: 'projected', allocations }`.

Tests will pin this contract.

### Build log

1. Scaffolded Vite + React + TS + Vitest by hand (no `create-vite`). Five tiny config files; faster than the wizard for an MVP.
2. `npm install` failed first try — sandbox blocks the default npm cache (`~/.npm`). Re-ran with `--cache "$TMPDIR/npm-cache"` and it worked.
3. Wrote 9 allocator tests covering: even pacing, urgency ordering, monthly-min fee avoidance, pinned override, actual-supersedes-projection, completion detection, external-push attribution, feasibility feasible/infeasible. All passed first run after writing the allocator.
4. UI built top-down: App → Setup, Grid, WhatIf. Grid is the bulk of it — sparkline, header cards with per-bonus progress bars, click-to-edit cells (becomes Override events), click-date-to-mark-actual.
5. `tsc` flagged one unused-param after refactor; fixed.
6. Build clean: 164 KB JS (gzip 52 KB). Acceptable for an MVP.

### Verification limitation

Couldn't headlessly screenshot from this sandbox — Chrome's process-singleton check requires socket creation which the sandbox denies. The dev server itself serves valid HTML (`curl http://127.0.0.1:5173/` returned expected output). The seed test prints the full forecast for eyeballing, and matches the user's hand-calculated plan within reasonable tolerance — see README's "Verifying against the source notes" section.

### Forecast vs. user's manual plan (4/17 paycheck, seed data)

| Account     | User's plan | Allocator | Notes |
|-------------|------------:|----------:|-------|
| Citi        | $401        | $599      | Even pacing vs. user's front-loaded then tapered |
| Byline      | $0          | $0        | Both flag deadline already missed/done |
| Wells Fargo | $201        | $199      | Match |
| Huntington  | $0          | $0        | Both skip; allocator picks it up later for monthly-min |
| Busey       | $976        | $951      | Match within $25 |
| BCU         | $1,001      | $750      | Allocator spreads evenly across 4 paychecks (user spread less evenly) |
| **Total**   | **$2,579**  | **$2,499** | Close; differences are valid alternative pacings |

Defensible difference: greedy allocator favors even pacing; user's notes were more opportunistic (front-load X, back-load Y). The allocator behavior is intentional and easy to override via pinned cells.

Notable correct catch: with the seeded actuals, Byline is flagged **will-miss** ($1k progress vs. $4k target, deadline 4/15 — only one more biweekly paycheck before deadline). The user's notes mention "expecting also on 4/10/26" — i.e., they were counting on a bonus increment landing. If that's an actual deposit, the user should mark it actual and the will-miss flag clears.

---

## 2026-06-24 — UX simplification refactor

Implemented the full UX restructuring per `bank_bonus_allocator_plan.md`.

### What changed
- **Single-page layout** replacing tabs (Accounts / Forecast / What-if). WhatIf.tsx deleted.
- **Monthly minimum removed entirely** from engine: `monthlyMinCents` dropped from `Account` type, `fee-min` status dropped from `AccountSummary`, phase-3 fee-avoidance block removed from allocator, month-tracking removed from replay. Seed accounts (Huntington, Ally, Synchrony) updated to `status: 'completed'`.
- **Example-data banner**: auto-loads "Mid-stream (6 accounts)" seed on first render; dismissible banner shows with "Start fresh →".
- **Alert banner**: recoverable/unrecoverable/missed alerts per account; "Write it off" dispatches `EditAccount status:'closed'`; "Replan around it" pins 0-overrides across future dates; "Add external push" pre-fills and scrolls to push form.
- **Next paycheck card**: prominent split table with inline editing (via `UpsertOverride`) and "Copy as text".
- **Forecast grid**: sparkline + color legend removed.
- **Settings/Account-config**: collapsed under `<details>` disclosures.
- **Debug mode**: `?debug=true` reveals scenario loader and Reset.

### Verification — pasted actual output

**All 58 tests pass:**
```
Test Files  7 passed (7)
     Tests  58 passed (58)
```
Test breakdown:
- `src/ui/alerts.test.ts` — 9 tests (alert classification: missed, recoverable, unrecoverable boundaries)
- `src/ui/nextPaycheck.test.ts` — 7 tests (split derivation, text formatting)
- `src/ui/App.test.tsx` — 13 component tests (banner, debug mode, removed features, alert wiring, next-paycheck card, settings disclosure, start-fresh)
- `src/core/reducer.test.ts` — 12 tests (engine unchanged)
- `src/model/allocator.test.ts` — 11 tests (fee-min tests deleted, others pass)
- `src/verify-seed.test.ts` — 1 test (seed sanity)
- `src/cli/cli.test.ts` — 5 tests (CLI subprocess)

**CLI headless sanity (today=2026-04-04):**
```
Citi       on-track    progress=$1,202 projected=$1,798 target=$3,000 deadline=2026-05-28
Byline     will-miss   progress=$1,002 projected=$0    target=$4,000 deadline=2026-04-15 SHORT=$2,998
Wells Fargo on-track   progress=$402   projected=$598   target=$1,000 deadline=2026-05-27
Huntington  completed  progress=$1,002 projected=$0    target=$0     deadline=2026-04-01
Busey       on-track   progress=$0     projected=$5,000 target=$5,000 deadline=2026-06-15
BCU         pre-start  progress=$0     projected=$3,000 target=$3,000 deadline=2026-06-07
```
Next paycheck (Apr 17): Citi $599 · Wells Fargo $199 · Busey $951 · BCU $750 = $2,500 (0 free)

**Build:** `tsc --noEmit && vite build` — clean, 171kB bundle.

**Dev server:** `curl -s http://127.0.0.1:5173/` returns valid HTML.

True browser screenshots remain sandbox-limited; jsdom component tests cover the interactive behavior (banner shows/dismisses, alert buttons dispatch correct actions, What-if/monthly-min are gone, debug mode gating).

---

## 2026-06-24 — post-review fixes (friend-testing round)

Fixed 7 issues found during hands-on review, plus 5 friend-testing polish items.

**Root causes:**
- Banner disappeared on write-off / settings edit: `setIsExampleData(false)` called on every edit. Fix: only clear on Start fresh / Clear all; persist flag via `storage.saveExample`.
- Grid row total ≠ visible cells: closed accounts got column hidden but `paycheck.totalCents` still included their historical allocation. Fix: `displayedAccounts()` helper includes closed accounts that have any non-zero historical allocation.
- Grid header `$0/$5000` while bar/status showed correct progress: header used `progressCents` (actuals only) while bar used `totalCents`. Fix: header now shows `totalCents/targetCents` with `(N actual)` suffix.
- Historical entry gone: `PastPaychecks` component was replaced by narrow `RecordActualSection`. Restored as `PaycheckHistorySection` (any-date entry, under "Paycheck history ▸" disclosure).
- Clear all gated behind `debug`: moved `onReset` into Settings disclosure.
- New account defaults: deadline was `today` → instant will-miss alert. Changed to `today + 90d`.
- "Accounts" rename to "Bonuses" in all user-facing copy.

**Verification — 80/80 tests (pasted from run):**
```
Test Files  9 passed (9)
     Tests  80 passed (80)
  Start at  21:16:18
  Duration  2.18s
```
New test files:
- `src/ui/validate.test.ts` — 7 tests: validateAccount all branches (closed/completed skip, deadline < opened, target ≤ 0)
- `src/ui/grid-helpers.test.ts` — 6 tests: displayedAccounts (includes closed-with-history, excludes closed-without, preserves order)
- `src/ui/App.test.tsx` — 22 tests (expanded): banner-stays-on-write-off regression, banner-stays-on-settings-edit regression, Reopen button, Clear all in Settings, Paycheck history section, Bonuses rename, subtitle/howto/footer

**Build:** `tsc --noEmit && vite build` — clean, 179kB bundle.

**CLI forecast (unchanged engine):**
```
Citi           on-track    progress=$1,202 projected=$1,798 target=$3,000
Byline         will-miss   progress=$1,002 projected=$0 target=$4,000 SHORT=$2,998
Wells Fargo    on-track    progress=$402 projected=$598 target=$1,000
Huntington     completed
Busey          on-track    progress=$0 projected=$5,000 target=$5,000
BCU            pre-start   progress=$0 projected=$3,000 target=$3,000
```

**Dev server:** `curl -s http://127.0.0.1:5173/` → `<div id="root">` ✓

Known residual: allocation to a *deleted* account ID (removed via ×) has no column in Grid — the allocated cents are invisible. Noted here; out of scope for this pass.
