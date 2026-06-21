// Habit "what got in the way" eligibility + inactivity check — pure functions, no Dexie.
//
// Psychology rule (CLAUDE.md §2/§10): this is informational, never a forced/blocking
// modal, never re-asked about the same missed period twice, never red/guilt copy.
// Cadence matters — a flexible/weekly habit must NOT be asked "why not today" just
// because of a single missed day; it's only asked once its weekly target is no
// longer mathematically reachable.

import { startOfISOWeek, endOfISOWeek, parseISO, format, subDays, differenceInCalendarDays } from 'date-fns'
import type { Habit, HabitLog, HabitSkipReason } from '../db/types'

export interface SkipPrompt {
  periodKey: string // the missed day (daily) or ISO week-start (flexible/weekly) being asked about
}

const yesterday = (today: string) => format(subDays(parseISO(today), 1), 'yyyy-MM-dd')

/**
 * Daily habits: only ever considers YESTERDAY — never a backlog of older
 * misses. That's what guarantees one prompt at a time, never a nag dump.
 */
export function getDailySkipPrompt(
  today: string,
  logDates: Set<string>,
  askedPeriodKeys: Set<string>,
  habitCreatedAt: string,
): SkipPrompt | null {
  const y = yesterday(today)
  if (y < habitCreatedAt.slice(0, 10)) return null
  if (logDates.has(y)) return null
  if (askedPeriodKeys.has(y)) return null
  return { periodKey: y }
}

/**
 * Flexible/weekly habits: eligible only once the current ISO week can no
 * longer mathematically reach targetPerWeek. Never fires mid-week just
 * because "today" wasn't logged.
 */
export function getFlexibleSkipPrompt(
  today: string,
  targetPerWeek: number,
  logDatesThisWeek: Set<string>,
  askedPeriodKeys: Set<string>,
): SkipPrompt | null {
  const weekStart = format(startOfISOWeek(parseISO(today)), 'yyyy-MM-dd')
  if (askedPeriodKeys.has(weekStart)) return null

  const needed = targetPerWeek - logDatesThisWeek.size
  if (needed <= 0) return null

  const remainingDaysInWeek = differenceInCalendarDays(endOfISOWeek(parseISO(today)), parseISO(today))
  if (remainingDaysInWeek >= needed) return null

  return { periodKey: weekStart }
}

/** Cadence dispatcher for the UI layer. Treats 'weekly' the same as 'flexible' (target-based). */
export function getSkipPrompt(
  habit: Pick<Habit, 'cadence' | 'targetPerWeek' | 'createdAt'>,
  today: string,
  logsForHabit: HabitLog[],
  skipReasonsForHabit: HabitSkipReason[],
): SkipPrompt | null {
  const askedPeriodKeys = new Set(skipReasonsForHabit.map(r => r.periodKey))

  if (habit.cadence === 'daily') {
    const logDates = new Set(logsForHabit.map(l => l.date))
    return getDailySkipPrompt(today, logDates, askedPeriodKeys, habit.createdAt)
  }

  const weekStart = startOfISOWeek(parseISO(today))
  const logDatesThisWeek = new Set(
    logsForHabit.filter(l => parseISO(l.date) >= weekStart).map(l => l.date),
  )
  return getFlexibleSkipPrompt(today, habit.targetPerWeek ?? 3, logDatesThisWeek, askedPeriodKeys)
}

/** Most recent NON-EMPTY reason for a habit (the "Last time: ..." echo), or null. */
export function getMostRecentReason(skipReasonsForHabit: HabitSkipReason[]): HabitSkipReason | null {
  const withText = skipReasonsForHabit.filter(r => r.reason.trim().length > 0)
  if (withText.length === 0) return null
  return withText.reduce((latest, r) => (r.createdAt > latest.createdAt ? r : latest))
}

export function daysSinceLastLog(today: string, lastLogDate: string | null): number | null {
  if (!lastLogDate) return null
  return differenceInCalendarDays(parseISO(today), parseISO(lastLogDate))
}

/** True once the habit has gone quiet for `thresholdDays` or more. Never true for a too-young habit. */
export function isInactiveTooLong(
  today: string,
  lastLogDate: string | null,
  habitCreatedAt: string,
  thresholdDays = 3,
): boolean {
  const createdDate = habitCreatedAt.slice(0, 10)
  const sinceCreated = differenceInCalendarDays(parseISO(today), parseISO(createdDate))
  if (sinceCreated < thresholdDays) return false

  const gap = daysSinceLastLog(today, lastLogDate)
  if (gap === null) return sinceCreated >= thresholdDays
  return gap >= thresholdDays
}
