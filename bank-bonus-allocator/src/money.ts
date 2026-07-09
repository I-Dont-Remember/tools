import type { Cents } from './model/types'

export function toCents(dollarStr: string | number): Cents {
  const n = typeof dollarStr === 'number' ? dollarStr : parseFloat(dollarStr || '0')
  if (Number.isNaN(n)) return 0
  return Math.round(n * 100)
}

export function fromCents(c: Cents): string {
  return (c / 100).toFixed(2)
}

export function fmtDollars(c: Cents, opts: { compact?: boolean } = {}): string {
  if (c < 0) return '-$' + (-c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (opts.compact && c >= 1_000_00) {
    return '$' + (c / 100_000).toFixed(1) + 'k'
  }
  return '$' + (c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })
}
