import { describe, it, expect, beforeEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { unlinkSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATE_PATH = `${process.env.TMPDIR ?? '/tmp'}/cli-test-state.json`
const NODE = process.execPath

function runCli(...args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(
    NODE,
    ['--import', 'tsx/esm', resolve(__dirname, 'index.ts'), '--state', STATE_PATH, ...args],
    { cwd: resolve(__dirname, '../..'), encoding: 'utf8' },
  )
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  }
}

beforeEach(() => {
  if (existsSync(STATE_PATH)) unlinkSync(STATE_PATH)
})

describe('cli', () => {
  it('seed loads scenario state', () => {
    const r = runCli('seed')
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('Seed scenario loaded')
  })

  it('forecast shows account names and dates after seed', () => {
    runCli('seed')
    const r = runCli('forecast', '--today', '2026-04-04')
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('Citi')
    expect(r.stdout).toContain('2026-04-17')
    expect(r.stdout).toContain('on-track')
  })

  it('act MarkPaycheckActual marks a row actual', () => {
    runCli('seed')
    const action = JSON.stringify({
      kind: 'MarkPaycheckActual',
      event: {
        kind: 'PaycheckSplit',
        id: 'pc-test',
        date: '2026-04-17',
        status: 'actual',
        allocations: { citi: 59900, wellsf: 19900 },
      },
    })
    const markResult = runCli('act', action)
    expect(markResult.status).toBe(0)
    expect(markResult.stdout).toContain('MarkPaycheckActual')

    const r = runCli('forecast', '--today', '2026-04-17')
    expect(r.stdout).toContain('✓2026-04-17')
  })

  it('feasibility reports shortfall for impossible bonus', () => {
    runCli('seed')
    const r = runCli('feasibility', 'BigBonus', '10000', '2026-05-01', '--today', '2026-04-04')
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('NOT FEASIBLE')
    expect(r.stdout).toContain('short')
  })

  it('reset wipes state', () => {
    runCli('seed')
    runCli('reset')
    const r = runCli('forecast', '--today', '2026-04-04')
    expect(r.stdout).toContain('(no accounts)')
  })
})
