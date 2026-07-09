/** Hover-tooltip descriptions for each status badge. Single source of truth — used in About modal and badge title attributes. */
export const STATUS_INFO: Record<string, string> = {
  'on-track': 'Progressing — projected to hit target before deadline.',
  'completed': 'Bonus target reached.',
  'will-miss': "At current pace, won't reach target by deadline.",
  'missed': 'Deadline passed and target was not met.',
  'pre-start': "Redirect hasn't applied yet; accumulation hasn't begun.",
}

export function statusClass(s: string): string {
  switch (s) {
    case 'completed': return 'good'
    case 'on-track': return 'good'
    case 'will-miss': return 'bad'
    case 'missed': return 'bad'
    case 'pre-start': return 'muted'
    default: return 'muted'
  }
}

export function statusColor(s: string): string {
  switch (s) {
    case 'completed': return 'var(--good)'
    case 'on-track': return 'var(--accent)'
    case 'will-miss': return 'var(--bad)'
    case 'missed': return 'var(--bad)'
    default: return 'var(--muted)'
  }
}
