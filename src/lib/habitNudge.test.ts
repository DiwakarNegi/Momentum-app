import { describe, it, expect } from 'vitest'
import {
  getDailySkipPrompt,
  getFlexibleSkipPrompt,
  getSkipPrompt,
  getMostRecentReason,
  daysSinceLastLog,
  isInactiveTooLong,
} from './habitNudge'
import type { Habit, HabitLog, HabitSkipReason } from '../db/types'

const set = (...dates: string[]) => new Set(dates)

describe('getDailySkipPrompt', () => {
  it('not eligible when yesterday was logged', () => {
    expect(getDailySkipPrompt('2024-06-08', set('2024-06-07'), set(), '2024-01-01T00:00:00.000Z')).toBeNull()
  })

  it('eligible when yesterday was missed', () => {
    expect(getDailySkipPrompt('2024-06-08', set(), set(), '2024-01-01T00:00:00.000Z'))
      .toEqual({ periodKey: '2024-06-07' })
  })

  it('never re-eligible once that day has already been asked about', () => {
    expect(getDailySkipPrompt('2024-06-08', set(), set('2024-06-07'), '2024-01-01T00:00:00.000Z')).toBeNull()
  })

  it('not eligible for a habit created today (no valid yesterday)', () => {
    expect(getDailySkipPrompt('2024-06-08', set(), set(), '2024-06-08T12:00:00.000Z')).toBeNull()
  })
})

describe('getFlexibleSkipPrompt', () => {
  // Week of 2024-06-03 (Mon) .. 2024-06-09 (Sun)
  it('a single missed mid-week day is NOT eligible — the core requirement', () => {
    // Wednesday, target 3, done once (Monday) — still 4 days left to hit target
    expect(getFlexibleSkipPrompt('2024-06-05', 3, set('2024-06-03'), set())).toBeNull()
  })

  it('eligible once remaining days < remaining needed completions', () => {
    // Saturday, target 3, done 0 so far — only Sat+Sun (2 days) left, need 3
    expect(getFlexibleSkipPrompt('2024-06-08', 3, set(), set()))
      .toEqual({ periodKey: '2024-06-03' })
  })

  it('not eligible once target already met', () => {
    expect(getFlexibleSkipPrompt('2024-06-08', 2, set('2024-06-03', '2024-06-04'), set())).toBeNull()
  })

  it('already-asked week is never re-prompted', () => {
    expect(getFlexibleSkipPrompt('2024-06-08', 3, set(), set('2024-06-03'))).toBeNull()
  })
})

describe('getSkipPrompt — cadence dispatch', () => {
  const dailyHabit: Pick<Habit, 'cadence' | 'targetPerWeek' | 'createdAt'> = {
    cadence: 'daily', targetPerWeek: undefined, createdAt: '2024-01-01T00:00:00.000Z',
  }
  const flexHabit: Pick<Habit, 'cadence' | 'targetPerWeek' | 'createdAt'> = {
    cadence: 'flexible', targetPerWeek: 3, createdAt: '2024-01-01T00:00:00.000Z',
  }

  it('daily habit dispatches to day-level logic', () => {
    const logs: HabitLog[] = []
    expect(getSkipPrompt(dailyHabit, '2024-06-08', logs, [])).toEqual({ periodKey: '2024-06-07' })
  })

  it('flexible habit with one mid-week miss is not eligible', () => {
    const logs: HabitLog[] = [{ id: '1', habitId: 'h', date: '2024-06-03' }]
    expect(getSkipPrompt(flexHabit, '2024-06-05', logs, [])).toBeNull()
  })

  it('weekly cadence is treated the same as flexible', () => {
    const weeklyHabit = { ...flexHabit, cadence: 'weekly' as const }
    const logs: HabitLog[] = []
    expect(getSkipPrompt(weeklyHabit, '2024-06-08', logs, [])).toEqual({ periodKey: '2024-06-03' })
  })

  it('logging today resolves any pending prompt — re-engaging is never followed by an interrogation', () => {
    const dailyLogs: HabitLog[] = [{ id: '1', habitId: 'h', date: '2024-06-08' }]
    expect(getSkipPrompt(dailyHabit, '2024-06-08', dailyLogs, [])).toBeNull()

    const flexLogs: HabitLog[] = [{ id: '1', habitId: 'h', date: '2024-06-08' }]
    expect(getSkipPrompt(flexHabit, '2024-06-08', flexLogs, [])).toBeNull()
  })
})

describe('getMostRecentReason', () => {
  it('returns null on empty input', () => {
    expect(getMostRecentReason([])).toBeNull()
  })

  it('returns null when all reasons are blank (skipped)', () => {
    const reasons: HabitSkipReason[] = [
      { id: '1', habitId: 'h', periodKey: '2024-06-01', reason: '', createdAt: '2024-06-02T00:00:00.000Z' },
    ]
    expect(getMostRecentReason(reasons)).toBeNull()
  })

  it('returns the latest non-empty reason', () => {
    const reasons: HabitSkipReason[] = [
      { id: '1', habitId: 'h', periodKey: '2024-05-01', reason: 'too tired', createdAt: '2024-05-02T00:00:00.000Z' },
      { id: '2', habitId: 'h', periodKey: '2024-06-01', reason: 'busy at work', createdAt: '2024-06-02T00:00:00.000Z' },
      { id: '3', habitId: 'h', periodKey: '2024-06-03', reason: '', createdAt: '2024-06-04T00:00:00.000Z' },
    ]
    expect(getMostRecentReason(reasons)?.reason).toBe('busy at work')
  })
})

describe('daysSinceLastLog / isInactiveTooLong', () => {
  it('daysSinceLastLog is null when never logged', () => {
    expect(daysSinceLastLog('2024-06-08', null)).toBeNull()
  })

  it('isInactiveTooLong false at 0-2 days', () => {
    expect(isInactiveTooLong('2024-06-08', '2024-06-07', '2024-01-01T00:00:00.000Z')).toBe(false)
    expect(isInactiveTooLong('2024-06-08', '2024-06-06', '2024-01-01T00:00:00.000Z')).toBe(false)
  })

  it('isInactiveTooLong true at 3+ days', () => {
    expect(isInactiveTooLong('2024-06-08', '2024-06-05', '2024-01-01T00:00:00.000Z')).toBe(true)
  })

  it('false for a habit too young to have a 3-day gap yet', () => {
    expect(isInactiveTooLong('2024-06-08', null, '2024-06-07T00:00:00.000Z')).toBe(false)
  })

  it('true for an old habit that was never logged', () => {
    expect(isInactiveTooLong('2024-06-08', null, '2024-01-01T00:00:00.000Z')).toBe(true)
  })
})
