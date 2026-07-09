import type { Account } from '../model/types'

/** Returns a list of user-facing validation error messages. Empty = valid. */
export function validateAccount(acc: Account): string[] {
  if (acc.status === 'closed' || acc.status === 'completed') return []
  const errors: string[] = []
  if (acc.bonus.targetCents <= 0) errors.push('Target must be greater than $0')
  if (acc.bonus.deadlineDate < acc.openedDate) errors.push('Deadline must be on or after opened date')
  return errors
}
