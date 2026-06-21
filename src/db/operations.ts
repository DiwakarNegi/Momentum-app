// All DB writes go through here. Every mutation that can affect momentum or
// streak calls recomputeToday() so snapshots stay current.

import { v4 as uuid } from 'uuid'
import { format, subDays, differenceInCalendarDays, parseISO } from 'date-fns'
import { db, getMeta, setMeta } from './index'
import type { FocusSession, FocusTask, Habit, HabitLog, HabitSkipReason, JobApplication, JobStage, Meta, MomentumSnapshot, Reflection } from './types'
import {
  computeDailyActivity,
  applyDecay,
  backfillDecay,
  FLOOR,
} from '../lib/momentum'
import { computeStreak } from '../lib/streak'
import { pushToCloud } from '../lib/supabase'

// ─── Cloud sync (debounced — fires 2s after last write) ───────────────────────

let _syncTimer: ReturnType<typeof setTimeout> | null = null

async function buildDataPayload() {
  const [habits, habitLogs, jobApplications, reflections, momentumSnapshots, focusSessions, focusTasks, habitSkipReasons, meta] =
    await Promise.all([
      db.habits.toArray(),
      db.habitLogs.toArray(),
      db.jobApplications.toArray(),
      db.reflections.toArray(),
      db.momentumSnapshots.toArray(),
      db.focusSessions.toArray(),
      db.focusTasks.toArray(),
      db.habitSkipReasons.toArray(),
      db.meta.toArray(),
    ])
  return { version: 4, habits, habitLogs, jobApplications, reflections, momentumSnapshots, focusSessions, focusTasks, habitSkipReasons, meta }
}

function scheduleSyncToCloud() {
  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(async () => {
    _syncTimer = null
    try { await pushToCloud(await buildDataPayload()) }
    catch (e) { console.error('Cloud sync failed:', e) }
  }, 2000)
}

// ─── Date helper ─────────────────────────────────────────────────────────────

export const today = () => format(new Date(), 'yyyy-MM-dd')

// ─── Momentum recompute ───────────────────────────────────────────────────────

/**
 * Recompute the momentum snapshot for today (and backfill any missed days).
 * Called after every write that can change activity.
 */
export async function recomputeToday(): Promise<void> {
  const todayStr = today()

  // 1. Find the most recent snapshot before today
  // .last() gives the highest-keyed row (most recent date, since date is the PK)
  const lastSnap = await db.momentumSnapshots
    .where('date').below(todayStr)
    .last() ?? null

  const lastDate  = lastSnap?.date ?? format(subDays(parseISO(todayStr), 1), 'yyyy-MM-dd')
  const baseScore = lastSnap?.score ?? 50

  // 2. Backfill any days between lastDate and today with pure decay
  const gap = differenceInCalendarDays(parseISO(todayStr), parseISO(lastDate))
  if (gap > 1) {
    // gap-1 missed days sit between lastDate and today
    let s = baseScore
    for (let i = 1; i < gap; i++) {
      const d = format(subDays(parseISO(todayStr), gap - i), 'yyyy-MM-dd')
      s = Math.max(FLOOR, s * 0.90)
      await db.momentumSnapshots.put({ date: d, score: Math.round(s) })
    }
  }

  // 3. Compute today's activity
  const prevScore = gap >= 1 ? backfillDecay(baseScore, gap - 1) : baseScore
  const activity  = await getTodayActivity(todayStr)
  const raw       = computeDailyActivity(activity)
  const newScore  = applyDecay(prevScore, raw)

  await db.momentumSnapshots.put({ date: todayStr, score: Math.round(newScore) })

  // 4. Update personal best streak
  await recomputePersonalBest(todayStr)

  // 5. Sync to cloud (debounced)
  scheduleSyncToCloud()
}

async function getTodayActivity(dateStr: string) {
  const [logs, reflection, apps, focus] = await Promise.all([
    db.habitLogs.where('date').equals(dateStr).count(),
    db.reflections.where('date').equals(dateStr).first(),
    db.jobApplications.toArray(),
    db.focusSessions.where('date').equals(dateStr).toArray(),
  ])

  // Count distinct apps with any stage action on this date
  const jobActions = apps.filter(app => {
    const createdToday = app.createdAt.startsWith(dateStr)
    const movedToday   = app.stageHistory.some(h => h.at.startsWith(dateStr))
    return createdToday || movedToday
  }).length

  return {
    habitsCompleted: logs,
    jobActions,
    reflectionDone:  !!reflection,
    focusSessions:   focus.filter(s => s.completed).length,
  }
}

async function recomputePersonalBest(todayStr: string): Promise<void> {
  // Build the set of all active dates (any log/app-action/reflection/focus)
  const [logs, reflections, apps, focus] = await Promise.all([
    db.habitLogs.toArray(),
    db.reflections.toArray(),
    db.jobApplications.toArray(),
    db.focusSessions.toArray(),
  ])
  const activeDates = new Set<string>()
  logs.forEach(l => activeDates.add(l.date))
  reflections.forEach(r => activeDates.add(r.date))
  focus.forEach(s => activeDates.add(s.date))
  apps.forEach(app => {
    if (app.createdAt) activeDates.add(app.createdAt.slice(0, 10))
    app.stageHistory.forEach(h => activeDates.add(h.at.slice(0, 10)))
  })

  const storedBest = await getMeta<number>('personalBestStreak', 0)
  const { personalBest } = computeStreak(todayStr, activeDates, storedBest)
  if (personalBest > storedBest) {
    await setMeta('personalBestStreak', personalBest)
  }
}

// ─── Habit operations ─────────────────────────────────────────────────────────

export async function addHabit(data: Omit<Habit, 'id' | 'createdAt' | 'archived'>): Promise<string> {
  const id = uuid()
  await db.habits.add({ ...data, id, createdAt: new Date().toISOString(), archived: false })
  return id
}

export async function updateHabit(id: string, data: Partial<Omit<Habit, 'id'>>): Promise<void> {
  await db.habits.update(id, data)
}

export async function archiveHabit(id: string): Promise<void> {
  await db.habits.update(id, { archived: true })
}

export async function toggleHabitLog(habitId: string, dateStr: string): Promise<void> {
  const existing = await db.habitLogs
    .where('[habitId+date]').equals([habitId, dateStr])
    .first()
  if (existing) {
    await db.habitLogs.delete(existing.id)
  } else {
    await db.habitLogs.add({ id: uuid(), habitId, date: dateStr })
  }
  await recomputeToday()
}

// Informational only — never calls recomputeToday(). Per CLAUDE.md §10 this
// must never affect momentum/streak, and the prompt it backs must never be a
// forced/blocking dialog (see HabitGarden.tsx).
export async function saveHabitSkipReason(habitId: string, periodKey: string, reason: string): Promise<void> {
  const existing = await db.habitSkipReasons
    .where('[habitId+periodKey]').equals([habitId, periodKey])
    .first()
  if (existing) {
    await db.habitSkipReasons.update(existing.id, { reason })
  } else {
    await db.habitSkipReasons.add({ id: uuid(), habitId, periodKey, reason, createdAt: new Date().toISOString() })
  }
  scheduleSyncToCloud()
}

export async function deleteHabitSkipReason(id: string): Promise<void> {
  await db.habitSkipReasons.delete(id)
  scheduleSyncToCloud()
}

// ─── Job application operations ───────────────────────────────────────────────

export async function addJobApplication(
  data: Omit<JobApplication, 'id' | 'createdAt' | 'updatedAt' | 'stageHistory'>,
): Promise<string> {
  const id  = uuid()
  const now = new Date().toISOString()
  await db.jobApplications.add({
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
    stageHistory: [{ stage: data.stage, at: now }],
  })
  await recomputeToday()
  return id
}

export async function moveJobStage(id: string, newStage: JobStage): Promise<void> {
  const app = await db.jobApplications.get(id)
  if (!app) return
  const now = new Date().toISOString()
  await db.jobApplications.update(id, {
    stage: newStage,
    updatedAt: now,
    stageHistory: [...app.stageHistory, { stage: newStage, at: now }],
  })
  await recomputeToday()
}

export async function updateJobApplication(
  id: string,
  data: Partial<Pick<JobApplication, 'company' | 'role' | 'link' | 'notes' | 'fitScore' | 'reframe'>>,
): Promise<void> {
  await db.jobApplications.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteJobApplication(id: string): Promise<void> {
  await db.jobApplications.delete(id)
  await recomputeToday()
}

// ─── Settings operations ──────────────────────────────────────────────────────

export async function updateSetting(key: string, value: Meta['value']): Promise<void> {
  await setMeta(key, value)
}

// ─── Data management ──────────────────────────────────────────────────────────

export async function exportAllData(): Promise<void> {
  const [habits, habitLogs, jobApplications, reflections, momentumSnapshots, focusSessions, focusTasks, habitSkipReasons, meta] =
    await Promise.all([
      db.habits.toArray(),
      db.habitLogs.toArray(),
      db.jobApplications.toArray(),
      db.reflections.toArray(),
      db.momentumSnapshots.toArray(),
      db.focusSessions.toArray(),
      db.focusTasks.toArray(),
      db.habitSkipReasons.toArray(),
      db.meta.toArray(),
    ])

  const payload = {
    version:    4,
    exportedAt: new Date().toISOString(),
    habits,
    habitLogs,
    jobApplications,
    reflections,
    momentumSnapshots,
    focusSessions,
    focusTasks,
    habitSkipReasons,
    meta,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `momentum-backup-${today()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importAllData(jsonText: string): Promise<void> {
  const data = JSON.parse(jsonText) as Record<string, unknown>

  // Light validation — must have the core arrays
  if (
    !Array.isArray(data.habits) ||
    !Array.isArray(data.habitLogs) ||
    !Array.isArray(data.jobApplications)
  ) {
    throw new Error('Invalid backup file — missing required data.')
  }

  // Clear then bulk-insert inside a transaction
  await db.transaction('rw', [db.habits, db.habitLogs, db.jobApplications, db.reflections, db.momentumSnapshots, db.focusSessions, db.focusTasks, db.habitSkipReasons, db.meta], async () => {
    await Promise.all([
      db.habits.clear(),
      db.habitLogs.clear(),
      db.jobApplications.clear(),
      db.reflections.clear(),
      db.momentumSnapshots.clear(),
      db.focusSessions.clear(),
      db.focusTasks.clear(),
      db.habitSkipReasons.clear(),
      db.meta.clear(),
    ])
    await Promise.all([
      db.habits.bulkAdd(data.habits as Habit[]),
      db.habitLogs.bulkAdd(data.habitLogs as HabitLog[]),
      db.jobApplications.bulkAdd(data.jobApplications as JobApplication[]),
      Array.isArray(data.reflections)       ? db.reflections.bulkAdd(data.reflections as Reflection[])                   : Promise.resolve(),
      Array.isArray(data.momentumSnapshots) ? db.momentumSnapshots.bulkAdd(data.momentumSnapshots as MomentumSnapshot[]) : Promise.resolve(),
      Array.isArray(data.focusSessions)     ? db.focusSessions.bulkAdd(data.focusSessions as FocusSession[])             : Promise.resolve(),
      Array.isArray(data.focusTasks)        ? db.focusTasks.bulkAdd(data.focusTasks as FocusTask[])                      : Promise.resolve(),
      Array.isArray(data.habitSkipReasons)  ? db.habitSkipReasons.bulkAdd(data.habitSkipReasons as HabitSkipReason[])    : Promise.resolve(),
      Array.isArray(data.meta)              ? db.meta.bulkAdd(data.meta as Meta[])                                       : Promise.resolve(),
    ])
  })
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.habits, db.habitLogs, db.jobApplications, db.reflections, db.momentumSnapshots, db.focusSessions, db.focusTasks, db.habitSkipReasons, db.meta], async () => {
    await Promise.all([
      db.habits.clear(),
      db.habitLogs.clear(),
      db.jobApplications.clear(),
      db.reflections.clear(),
      db.momentumSnapshots.clear(),
      db.focusSessions.clear(),
      db.focusTasks.clear(),
      db.habitSkipReasons.clear(),
      db.meta.clear(),
    ])
  })
  // Mark initialized so seed doesn't re-run on next load, then sync empty state to cloud
  await setMeta('initialized', true)
  try {
    const payload = await buildDataPayload()
    await pushToCloud(payload)
  } catch (e) {
    console.error('Failed to sync clear to cloud:', e)
  }
}

// ─── Focus session operations ─────────────────────────────────────────────────

export async function saveFocusSession(
  data: Omit<FocusSession, 'id' | 'date' | 'createdAt' | 'endedAt'>,
): Promise<FocusSession> {
  const id      = uuid()
  const now     = new Date().toISOString()
  const session: FocusSession = {
    ...data,
    id,
    date:      today(),
    createdAt: now,
    endedAt:   now,
  }
  await db.focusSessions.add(session)
  await recomputeToday()
  return session
}

export async function deleteFocusSession(id: string): Promise<void> {
  await db.focusSessions.delete(id)
  await recomputeToday()
}

// ─── Focus task operations ────────────────────────────────────────────────────

export async function addFocusTask(title: string): Promise<FocusTask> {
  const task: FocusTask = {
    id:        uuid(),
    title:     title.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
  }
  await db.focusTasks.add(task)
  return task
}

export async function toggleFocusTask(id: string): Promise<void> {
  const task = await db.focusTasks.get(id)
  if (!task) return
  await db.focusTasks.update(id, {
    completed:   !task.completed,
    completedAt: !task.completed ? new Date().toISOString() : undefined,
  })
}

export async function deleteFocusTask(id: string): Promise<void> {
  await db.focusTasks.delete(id)
}

export async function clearCompletedFocusTasks(): Promise<void> {
  const completed = await db.focusTasks.where('completed').equals(1).toArray()
  await db.focusTasks.bulkDelete(completed.map(t => t.id))
}

export async function updateFocusTaskTitle(id: string, title: string): Promise<void> {
  await db.focusTasks.update(id, { title: title.trim() })
}

// ─── Reflection operations ────────────────────────────────────────────────────

export async function upsertReflection(
  data: Omit<Reflection, 'id'>,
): Promise<void> {
  const existing = await db.reflections.where('date').equals(data.date).first()
  if (existing) {
    await db.reflections.update(existing.id, data)
  } else {
    await db.reflections.add({ ...data, id: uuid() })
  }
  await recomputeToday()
}
