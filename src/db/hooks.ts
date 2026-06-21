// Typed useLiveQuery hooks — components never touch Dexie directly.

import { useLiveQuery } from 'dexie-react-hooks'
import { format, subDays, startOfISOWeek, parseISO } from 'date-fns'
import { db, getMeta } from './index'
import { computeStreak } from '../lib/streak'
import type { Habit, HabitLog, JobApplication, MomentumSnapshot, Reflection } from './types'
import type { WeekAggregate } from '../lib/insight'

export const todayStr = () => format(new Date(), 'yyyy-MM-dd')

// ─── Habits ──────────────────────────────────────────────────────────────────

export function useHabits(): Habit[] | undefined {
  // Use toArray + JS filter/sort — `archived` is a boolean so index equals(0)
  // never matches, and `createdAt` is not in the schema index so orderBy throws.
  return useLiveQuery(async () => {
    const all = await db.habits.toArray()
    return all
      .filter(h => !h.archived)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  })
}

export function useHabitLogs(days = 56): HabitLog[] | undefined {
  return useLiveQuery(() => {
    const since = format(subDays(new Date(), days), 'yyyy-MM-dd')
    return db.habitLogs.where('date').aboveOrEqual(since).toArray()
  }, [days])
}

export function useTodayLogs(): HabitLog[] | undefined {
  return useLiveQuery(() =>
    db.habitLogs.where('date').equals(todayStr()).toArray()
  )
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export function useJobApplications(): JobApplication[] | undefined {
  return useLiveQuery(() => db.jobApplications.toArray())
}

// ─── Reflection ───────────────────────────────────────────────────────────────

export function useTodayReflection(): Reflection | undefined {
  return useLiveQuery(() =>
    db.reflections.where('date').equals(todayStr()).first()
  )
}

export function useReflections(limit = 30): Reflection[] | undefined {
  return useLiveQuery(() =>
    db.reflections.orderBy('date').reverse().limit(limit).toArray()
  )
}

// ─── Momentum ─────────────────────────────────────────────────────────────────

export function useMomentumSnapshots(days = 30): MomentumSnapshot[] | undefined {
  return useLiveQuery(() => {
    const since = format(subDays(new Date(), days - 1), 'yyyy-MM-dd')
    return db.momentumSnapshots.where('date').aboveOrEqual(since).sortBy('date')
  }, [days])
}

export function useTodayScore(): number | undefined {
  return useLiveQuery(async () => {
    const snap = await db.momentumSnapshots.get(todayStr())
    return snap?.score ?? 50
  })
}

// ─── Active dates (for streak dot row) ───────────────────────────────────────

export function useActiveDates(days = 30): Set<string> | undefined {
  return useLiveQuery(async () => {
    const since = format(subDays(new Date(), days), 'yyyy-MM-dd')
    const [logs, refs, apps, focus] = await Promise.all([
      db.habitLogs.where('date').aboveOrEqual(since).toArray(),
      db.reflections.where('date').aboveOrEqual(since).toArray(),
      db.jobApplications.toArray(),
      db.focusSessions.where('date').aboveOrEqual(since).toArray(),
    ])
    const active = new Set<string>()
    logs.forEach(l => active.add(l.date))
    refs.forEach(r => active.add(r.date))
    focus.forEach(s => active.add(s.date))
    apps.forEach(app => {
      const d = app.createdAt.slice(0, 10)
      if (d >= since) active.add(d)
      app.stageHistory.forEach(h => {
        const sd = h.at.slice(0, 10)
        if (sd >= since) active.add(sd)
      })
    })
    return active
  }, [days])
}

// ─── App settings ─────────────────────────────────────────────────────────────

export interface AppSettings {
  showWeeklyInsights: boolean
  showReframePrompt:  boolean
}

export function useSettings(): AppSettings | undefined {
  return useLiveQuery(async () => {
    const [insights, reframe] = await Promise.all([
      getMeta<boolean>('showWeeklyInsights', true),
      getMeta<boolean>('showReframePrompt',  true),
    ])
    return { showWeeklyInsights: insights, showReframePrompt: reframe }
  })
}

// ─── Weekly aggregates (for insight engine) ───────────────────────────────────

export function useWeekAggregates(numWeeks = 8): WeekAggregate[] | undefined {
  return useLiveQuery(async () => {
    const since = format(subDays(new Date(), numWeeks * 7), 'yyyy-MM-dd')
    const [logs, reflections, apps] = await Promise.all([
      db.habitLogs.where('date').aboveOrEqual(since).toArray(),
      db.reflections.where('date').aboveOrEqual(since).toArray(),
      db.jobApplications.toArray(),
    ])

    // Map dateStr → ISO-week Monday (yyyy-MM-dd)
    const weekStart = (dateStr: string) =>
      format(startOfISOWeek(parseISO(dateStr)), 'yyyy-MM-dd')

    const map = new Map<string, { energyValues: number[]; habitCount: number; appCount: number }>()

    function ensure(wk: string) {
      if (!map.has(wk)) map.set(wk, { energyValues: [], habitCount: 0, appCount: 0 })
      return map.get(wk)!
    }

    logs.forEach(l => { ensure(weekStart(l.date)).habitCount++ })
    reflections.forEach(r => { ensure(weekStart(r.date)).energyValues.push(r.energy) })
    apps.forEach(app => {
      const d = app.createdAt.slice(0, 10)
      if (d >= since) ensure(weekStart(d)).appCount++
    })

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ws, data]) => ({
        weekStart: ws,
        avgEnergy: data.energyValues.length > 0
          ? data.energyValues.reduce((a, b) => a + b, 0) / data.energyValues.length
          : null,
        habitsCompleted: data.habitCount,
        appsSent:        data.appCount,
      }))
  }, [numWeeks])
}

// ─── Focus sessions ───────────────────────────────────────────────────────────

export function useFocusTasks(): import('./types').FocusTask[] | undefined {
  return useLiveQuery(() =>
    db.focusTasks.orderBy('createdAt').toArray()
  )
}

export function useFocusSessions(days = 7): import('./types').FocusSession[] | undefined {
  return useLiveQuery(() => {
    const since = format(subDays(new Date(), days), 'yyyy-MM-dd')
    return db.focusSessions.where('date').aboveOrEqual(since).reverse().sortBy('createdAt')
  }, [days])
}

export function useTodayFocusSessions(): import('./types').FocusSession[] | undefined {
  return useLiveQuery(() =>
    db.focusSessions.where('date').equals(todayStr()).toArray()
  )
}

// ─── Habit skip reasons ────────────────────────────────────────────────────────

export function useHabitSkipReasons(): import('./types').HabitSkipReason[] | undefined {
  return useLiveQuery(() => db.habitSkipReasons.toArray())
}

// ─── Streak ───────────────────────────────────────────────────────────────────

export function useStreak() {
  return useLiveQuery(async () => {
    const [logs, reflections, apps, storedBest] = await Promise.all([
      db.habitLogs.toArray(),
      db.reflections.toArray(),
      db.jobApplications.toArray(),
      getMeta<number>('personalBestStreak', 0),
    ])
    const activeDates = new Set<string>()
    logs.forEach(l => activeDates.add(l.date))
    reflections.forEach(r => activeDates.add(r.date))
    apps.forEach(app => {
      if (app.createdAt) activeDates.add(app.createdAt.slice(0, 10))
      app.stageHistory.forEach(h => activeDates.add(h.at.slice(0, 10)))
    })
    return computeStreak(todayStr(), activeDates, storedBest)
  })
}
