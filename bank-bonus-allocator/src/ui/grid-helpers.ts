import type { Account } from '../model/types'
import type { ProjectedPaycheck } from '../model/allocator'

/**
 * Returns accounts to render as columns in the Forecast Grid.
 * Includes all non-closed accounts PLUS any closed accounts that have a
 * non-zero historical allocation in any displayed paycheck — so row totals
 * remain consistent with the visible cell sum.
 * Original account order is preserved.
 */
export function displayedAccounts(accounts: Account[], paychecks: ProjectedPaycheck[]): Account[] {
  return accounts.filter(a => {
    if (a.status !== 'closed') return true
    return paychecks.some(p => (p.allocations[a.id] ?? 0) > 0)
  })
}
