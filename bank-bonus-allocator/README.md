# Bank Bonus Allocator

A browser-local tool for people juggling multiple bank-account signup bonuses at once. Answers one question: **how do I split my next few paychecks to hit every bonus deadline?**

## The problem

Each bank-account bonus is a constraint like *"get $4,000 of qualifying direct deposit within 90 days of opening."* When you're running 3–6 of these at once, all starting on different dates with different targets, deciding how to split your single biweekly paycheck across them becomes a mental-arithmetic chore that needs redoing whenever:

- a bonus completes (free capacity)
- a new offer opens (where does it fit?)
- an actual paycheck lands at slightly different amounts than planned
- a deadline is closer than you thought

## What this does

1. **Tells you what splits to set** for your next paycheck elections (the "Next paycheck" card).
2. **Flags at-risk bonuses** with an alert banner and specific actions: "Add external push", "Skip this one", "Write it off".
3. **Forecasts over the next ~10 paychecks** in a grid; click any cell to override an allocation; click the date to mark a paycheck "actual" (downstream re-allocates).
4. **Records historical paychecks** ("Paycheck history ▸") so you can start mid-stream.
5. **First-class external pushes** (e.g., ACH from Ally) logged as separate events.
6. **All data stays local** — localStorage only, nothing uploaded. Runs entirely in the browser.

## Getting started

Open the app. Example data loads automatically so you can see how it works.

1. Open **Settings ▸** and enter your paycheck amount, cadence, and next date.
2. Open **Configure bonuses ▸** and add each bank account (name, opened date, target spend, deadline).
3. The **Next paycheck** card shows the recommended split. Heed any red alerts.
4. After each paycheck lands, mark it **actual** in the Forecast grid (click the date) or enter it in **Paycheck history ▸**.

When you're ready to use real data, click **Start fresh →** in the example-data banner.

## Architecture

- **Event-sourced ledger.** Three event kinds — `PaycheckSplit`, `ExternalPush`, `Override`. State is `replay(events)`. Forecast is `forecast(accounts, config, events, today)` — pure, runs every render. Nothing about projections is persisted.
- **Greedy allocator.** For each future paycheck: apply pinned overrides, then fill remaining capacity sorted by `(soonest-deadline, highest-required-pace)`.
- **Money as integer cents** end-to-end. `YYYY-MM-DD` strings for dates with UTC-only helpers.

## Stack

Vite + React + TypeScript, Vitest + jsdom + Testing Library. No backend. State in `localStorage`. ~180 KB JS bundle.

## Run

```bash
npm install --cache "$TMPDIR/npm-cache"  # sandbox-friendly; or just `npm install` outside
npm test                                  # 80 tests
npm run dev                               # http://127.0.0.1:5173/
npm run build
```

Use `?debug=true` to expose a scenario loader and Reset button.

## Files

```
src/
  model/
    types.ts           Account, Event, State, PaycheckConfig
    dates.ts           UTC YYYY-MM-DD helpers
    replay.ts          events → State
    allocator.ts       forecast() + feasibility()
    allocator.test.ts
  ui/
    App.tsx            single-page shell + all sections
    Grid.tsx           forecast grid + per-account summary columns
    AccountCards.tsx   accounts-at-a-glance + status guide
    alerts.ts          pure alert classification (will-miss/missed → recoverable/unrecoverable)
    nextPaycheck.ts    pure next-split derivation
    validate.ts        account input validation
    grid-helpers.ts    displayedAccounts (includes closed cols with historical data)
    seed.ts            example scenarios
    status.ts          status → CSS class / color
  money.ts             cents ↔ dollar string helpers
  storage.ts           localStorage I/O + example-flag persistence
  main.tsx             React entry
  styles.css           minimal dark theme
  verify-seed.test.ts  integration smoke test
```

## What's in — and what isn't

In:
- Single paycheck stream, N bonuses
- Mark paychecks actual / projected
- Pin overrides per cell
- External-push events
- At-risk alerts with actionable buttons
- Paycheck history for mid-stream onboarding
- Input validation (deadline ≥ opened, target > 0)
- Clear-all in Settings; Reopen for written-off bonuses

Deliberately out:
- LP / optimal solver (greedy is good enough at this scale)
- Multiple paycheck streams
- Bank API / transaction import
- Auth, multi-user, hosted deploy

## Verification limitation

Headless screenshots of the UI aren't possible from the dev sandbox (Chrome process-singleton check blocked); `curl` confirms the dev server returns valid HTML. Run `npm run dev` locally to see the UI. The jsdom component tests (22 tests in `App.test.tsx`) cover the interactive DOM behavior in lieu of browser screenshots.
