# Bank Bonus Allocator — Claude context

## What this app does

Single-page app (`main.tsx` → `Home.tsx`). Helps users split paychecks across bank accounts to hit bonus spending/DD deadlines. Core job: "I'm running bonuses — how much capacity do I have, and can I take on another?"

`Home.tsx` owns everything: capacity hero, alerts, forecast grid (collapsible), bonus cards + "Add a bonus" form, external pushes, settings.

## Domain model

All money in integer **cents**. All dates ISO `'YYYY-MM-DD'`. Types in `src/model/types.ts`.
- `Account` — `id, name, openedDate, status, bonus.{targetCents, deadlineDate, startDate?}`
- `PaycheckConfig` — `amountCents, cadenceDays, nextDate, horizonPaychecks`
- `Event` — `PaycheckSplit | ExternalPush | Override` (event-sourced)
- `AppState = { config, accounts, events }` — localStorage key `bank-bonus-allocator/v1`

## Engine (never modify without understanding)

`src/model/allocator.ts` — `forecast(input): ForecastResult`. Pure, runs every render.

Greedy, earliest-deadline-first. Each paycheck: apply Overrides → sort active accounts by deadline then pace → allocate up to capacity.

- `feasibility({...input, proposed})` — live verdict for "Add a bonus" without mutating state.
- `replay(events)` — folds actuals into `State.actualByAccount`; only `status:'actual'` pushes count.
- **Projected external pushes** — `status:'projected'` ExternalPush events are applied in date order during the projection loop, reducing subsequent paycheck need and flipping `will-miss→on-track` if they cross the target. Completion date = push date.

## Key design decisions

- **Deadlines in days from open date** — AddBonus has "Opened on" (date picker) + "ends in N days"; `effectiveDeadline = addDays(openedStr, daysUntil)`.
- **Payroll lag = 1 checkbox** — shifts `startDate` to `upcomingDates[1]`; no engine change.
- **`pre-start` never suppresses `will-miss`** — fixed in allocator; `pre-start` only overrides benign statuses.
- **`dispatch + save` is the only write path** — never mutate `AppState` directly.
- **Breakdown modal** (`BonusBreakdown.tsx`) — per-bonus math: actuals (paychecks + done pushes), projected (future paychecks + planned pushes), total vs target. Triggered from bonus cards and grid header clicks.
- **Seed scenarios** (`src/ui/seed.ts`) — default "Mid-stream" includes an actual ACH push (Wells Cargo) and a partial planned push (Bylinear Bank, stays `will-miss` to keep the warning visible).

## Shared components

`sections.tsx` — `ExternalPushesSection`, `PaycheckHistorySection`, settings panel. `capacity.ts` — hero helpers. `status.ts` — `STATUS_INFO` single source of truth for status copy.

## CLI

`npx tsx src/cli/index.ts forecast --today YYYY-MM-DD --state path/to/state.json`

## Verification checklist

1. `npm run build` — clean (tsc + vite, 0 errors; `noUnusedLocals` is on)
2. `npx vitest run` — all green
3. Capacity hero total matches sum of `freeCents` over projected paychecks
4. "Add a bonus": "Opened on" date drives deadline hint and redirect start; verdict + next-split update live; form resets after add
5. Payroll-lag checkbox shifts start by one cycle
6. Bonus card "Edit ▸" / inline form saves immediately
7. `will-miss` alert fires even when `startDate` is future (`pre-start` must not suppress it)
8. Breakdown modal lists actuals, projected paychecks, and planned pushes with correct totals
