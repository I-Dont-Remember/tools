import type { ForecastResult } from '../model/allocator'

export const TYPICAL_BONUS_CENTS = 3_000_00 // $3,000 rough default

export function freeOverHorizon(fc: ForecastResult): number {
  return fc.paychecks.filter(p => !p.isActual).reduce((s, p) => s + p.freeCents, 0)
}

export function roomForBonuses(fc: ForecastResult, typicalCents: number): number {
  if (typicalCents <= 0) return 0
  return Math.floor(freeOverHorizon(fc) / typicalCents)
}
