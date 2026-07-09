import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { DEFAULT_STATE, type AppState } from '../core/state'
import { dispatch } from '../core/reducer'
import { renderForecastTable, renderAccountsSummary, renderCapacityProfile, renderHorizonWarning, feasibilityOf } from '../core/selectors'
import { seedScenario } from '../ui/seed'
import type { Action } from '../core/actions'
import type { Account } from '../model/types'
import { toCents } from '../money'

function loadState(path: string): AppState {
  if (!existsSync(path)) return DEFAULT_STATE
  try {
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return DEFAULT_STATE
  }
}

function saveState(path: string, state: AppState): void {
  writeFileSync(path, JSON.stringify(state, null, 2))
}

function parseArgs(argv: string[]) {
  const flags: Record<string, string> = {}
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      flags[key] = argv[i + 1] ?? 'true'
      i++
    } else {
      positional.push(argv[i])
    }
  }
  return { flags, positional }
}

function getToday(flags: Record<string, string>): string {
  return flags['today'] ?? new Date().toISOString().slice(0, 10)
}

const args = process.argv.slice(2)
const { flags, positional } = parseArgs(args)
const statePath = flags['state'] ?? './state.json'
const subcmd = positional[0]

let state = loadState(statePath)
let mutated = false

switch (subcmd) {
  case 'state':
    console.log(JSON.stringify(state, null, 2))
    break

  case 'forecast': {
    const today = getToday(flags)
    console.log('\n=== FORECAST ===')
    console.log(renderForecastTable(state, today))
    console.log('\n=== ACCOUNTS ===')
    console.log(renderAccountsSummary(state, today))
    console.log('\n=== CAPACITY ===')
    console.log(renderCapacityProfile(state, today))
    const warning = renderHorizonWarning(state, today)
    if (warning) console.log('\n' + warning)
    break
  }

  case 'feasibility': {
    const [, name, targetDollars, deadlineISO] = positional
    if (!name || !targetDollars || !deadlineISO) {
      console.error('Usage: feasibility <name> <targetDollars> <deadlineISO> [--opened ISO]')
      process.exit(1)
    }
    const today = getToday(flags)
    const proposed: Account = {
      id: 'PROPOSED',
      name,
      openedDate: flags['opened'] ?? today,
      status: 'active',
      bonus: { targetCents: toCents(parseFloat(targetDollars)), deadlineDate: deadlineISO },
    }
    const result = feasibilityOf(state, proposed, today)
    if (result.feasible) {
      console.log('FEASIBLE — every bonus (including the proposed one) can complete by its deadline.')
    } else {
      console.log('NOT FEASIBLE — shortfalls:')
      for (const s of result.shortfalls) {
        const acct = [...state.accounts, proposed].find(a => a.id === s.accountId)
        console.log(`  ${acct?.name ?? s.accountId}: short $${(s.shortfallCents / 100).toFixed(2)} by ${s.deadlineDate}`)
      }
    }
    break
  }

  case 'act': {
    const actionJson = positional[1]
    if (!actionJson) {
      console.error('Usage: act \'<action-json>\'')
      process.exit(1)
    }
    let action: Action | undefined
    try {
      action = JSON.parse(actionJson) as Action
    } catch {
      console.error('Invalid JSON:', actionJson)
      process.exit(1)
    }
    if (!action) { process.exit(1) }
    state = dispatch(state, action)
    mutated = true
    console.log('Action applied:', action.kind)
    break
  }

  case 'seed': {
    const s = seedScenario()
    state = { config: s.config, accounts: s.accounts, events: s.events }
    mutated = true
    console.log('Seed scenario loaded.')
    break
  }

  case 'reset':
    state = DEFAULT_STATE
    mutated = true
    console.log('State reset to defaults.')
    break

  default:
    console.error(`Unknown subcommand: ${subcmd ?? '(none)'}`)
    console.error('Subcommands: state, forecast, feasibility, act, seed, reset')
    process.exit(1)
}

if (mutated) {
  saveState(statePath, state)
  console.log(`State saved to ${statePath}`)
}
