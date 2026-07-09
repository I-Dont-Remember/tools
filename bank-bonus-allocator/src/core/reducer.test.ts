import { describe, it, expect } from 'vitest'
import { dispatch } from './reducer'
import { DEFAULT_STATE, type AppState } from './state'
import type { Account, ExternalPushEvent, OverrideEvent, PaycheckSplitEvent } from '../model/types'

const account: Account = {
  id: 'acc-1',
  name: 'Test Bank',
  openedDate: '2026-01-01',
  status: 'active',
  bonus: { targetCents: 1_000_00, deadlineDate: '2026-06-01' },
}

describe('reducer', () => {
  it('AddAccount appends account', () => {
    const s = dispatch(DEFAULT_STATE, { kind: 'AddAccount', account })
    expect(s.accounts).toHaveLength(1)
    expect(s.accounts[0]).toEqual(account)
  })

  it('EditAccount updates existing account', () => {
    const base: AppState = { ...DEFAULT_STATE, accounts: [account] }
    const updated = { ...account, name: 'Renamed' }
    const s = dispatch(base, { kind: 'EditAccount', account: updated })
    expect(s.accounts[0].name).toBe('Renamed')
  })

  it('RemoveAccount removes account by id', () => {
    const base: AppState = { ...DEFAULT_STATE, accounts: [account] }
    const s = dispatch(base, { kind: 'RemoveAccount', accountId: 'acc-1' })
    expect(s.accounts).toHaveLength(0)
  })

  it('SetPaycheckConfig updates config', () => {
    const newConfig = { ...DEFAULT_STATE.config, amountCents: 3_000_00 }
    const s = dispatch(DEFAULT_STATE, { kind: 'SetPaycheckConfig', config: newConfig })
    expect(s.config.amountCents).toBe(3_000_00)
  })

  it('AddExternalPush appends push event', () => {
    const event: ExternalPushEvent = {
      kind: 'ExternalPush',
      id: 'push-1',
      date: '2026-04-01',
      status: 'actual',
      sourceLabel: 'Ally',
      targetAccountId: 'acc-1',
      amountCents: 500_00,
    }
    const s = dispatch(DEFAULT_STATE, { kind: 'AddExternalPush', event })
    expect(s.events).toHaveLength(1)
    expect(s.events[0]).toEqual(event)
  })

  it('RemoveExternalPush removes event by id', () => {
    const event: ExternalPushEvent = {
      kind: 'ExternalPush',
      id: 'push-1',
      date: '2026-04-01',
      status: 'actual',
      sourceLabel: 'Ally',
      targetAccountId: 'acc-1',
      amountCents: 500_00,
    }
    const base: AppState = { ...DEFAULT_STATE, events: [event] }
    const s = dispatch(base, { kind: 'RemoveExternalPush', eventId: 'push-1' })
    expect(s.events).toHaveLength(0)
  })

  it('UpsertOverride adds override and replaces duplicate', () => {
    const ov: OverrideEvent = { kind: 'Override', id: 'ov-1', date: '2026-04-17', accountId: 'acc-1', pinCents: 200_00 }
    const s1 = dispatch(DEFAULT_STATE, { kind: 'UpsertOverride', event: ov })
    expect(s1.events).toHaveLength(1)
    // Replace with new value
    const ov2: OverrideEvent = { ...ov, id: 'ov-2', pinCents: 300_00 }
    const s2 = dispatch(s1, { kind: 'UpsertOverride', event: ov2 })
    expect(s2.events).toHaveLength(1)
    expect((s2.events[0] as OverrideEvent).pinCents).toBe(300_00)
  })

  it('ClearOverride removes matching override', () => {
    const ov: OverrideEvent = { kind: 'Override', id: 'ov-1', date: '2026-04-17', accountId: 'acc-1', pinCents: 200_00 }
    const base: AppState = { ...DEFAULT_STATE, events: [ov] }
    const s = dispatch(base, { kind: 'ClearOverride', date: '2026-04-17', accountId: 'acc-1' })
    expect(s.events).toHaveLength(0)
  })

  it('MarkPaycheckActual adds event and removes prior entry for same date', () => {
    const existing: PaycheckSplitEvent = {
      kind: 'PaycheckSplit', id: 'pc-old', date: '2026-04-17', status: 'actual', allocations: { 'acc-1': 100_00 },
    }
    const base: AppState = { ...DEFAULT_STATE, events: [existing] }
    const newEvt: PaycheckSplitEvent = {
      kind: 'PaycheckSplit', id: 'pc-new', date: '2026-04-17', status: 'actual', allocations: { 'acc-1': 200_00 },
    }
    const s = dispatch(base, { kind: 'MarkPaycheckActual', event: newEvt })
    expect(s.events).toHaveLength(1)
    expect((s.events[0] as PaycheckSplitEvent).allocations['acc-1']).toBe(200_00)
  })

  it('UnmarkPaycheckActual removes actual paycheck for date', () => {
    const evt: PaycheckSplitEvent = {
      kind: 'PaycheckSplit', id: 'pc-1', date: '2026-04-17', status: 'actual', allocations: {},
    }
    const base: AppState = { ...DEFAULT_STATE, events: [evt] }
    const s = dispatch(base, { kind: 'UnmarkPaycheckActual', date: '2026-04-17' })
    expect(s.events).toHaveLength(0)
  })

  it('LoadSeed replaces entire state', () => {
    const seedState: AppState = { ...DEFAULT_STATE, accounts: [account] }
    const s = dispatch(DEFAULT_STATE, { kind: 'LoadSeed', state: seedState, today: '2026-04-04' })
    expect(s.accounts).toHaveLength(1)
  })

  it('Reset returns default state', () => {
    const base: AppState = { ...DEFAULT_STATE, accounts: [account] }
    const s = dispatch(base, { kind: 'Reset' })
    expect(s.accounts).toHaveLength(0)
    expect(s).toEqual(DEFAULT_STATE)
  })
})
