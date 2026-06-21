import Dexie, { type Table } from 'dexie'
import type {
  Habit,
  HabitLog,
  JobApplication,
  Reflection,
  MomentumSnapshot,
  FocusSession,
  FocusTask,
  HabitSkipReason,
  Meta,
} from './types'

export class MomentumDB extends Dexie {
  habits!:             Table<Habit,             string>
  habitLogs!:          Table<HabitLog,          string>
  jobApplications!:    Table<JobApplication,    string>
  reflections!:        Table<Reflection,        string>
  momentumSnapshots!:  Table<MomentumSnapshot,  string>
  focusSessions!:      Table<FocusSession,      string>
  focusTasks!:         Table<FocusTask,         string>
  habitSkipReasons!:   Table<HabitSkipReason,   string>
  meta!:               Table<Meta,              string>

  constructor() {
    super('momentumDB')
    this.version(1).stores({
      habits:            'id, archived',
      habitLogs:         'id, [habitId+date], date',
      jobApplications:   'id, stage, updatedAt',
      reflections:       'id, date',
      momentumSnapshots: 'date',
      meta:              'key',
    })
    this.version(2).stores({
      habits:            'id, archived',
      habitLogs:         'id, [habitId+date], date',
      jobApplications:   'id, stage, updatedAt',
      reflections:       'id, date',
      momentumSnapshots: 'date',
      focusSessions:     'id, date, createdAt',
      meta:              'key',
    })
    this.version(3).stores({
      habits:            'id, archived',
      habitLogs:         'id, [habitId+date], date',
      jobApplications:   'id, stage, updatedAt',
      reflections:       'id, date',
      momentumSnapshots: 'date',
      focusSessions:     'id, date, createdAt',
      focusTasks:        'id, completed, createdAt',
      meta:              'key',
    })
    this.version(4).stores({
      habits:            'id, archived',
      habitLogs:         'id, [habitId+date], date',
      jobApplications:   'id, stage, updatedAt',
      reflections:       'id, date',
      momentumSnapshots: 'date',
      focusSessions:     'id, date, createdAt',
      focusTasks:        'id, completed, createdAt',
      habitSkipReasons:  'id, [habitId+periodKey], habitId',
      meta:              'key',
    })
  }
}

export const db = new MomentumDB()

// Typed meta helpers
export async function getMeta<T extends Meta['value']>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row ? (row.value as T) : fallback
}

export async function setMeta(key: string, value: Meta['value']): Promise<void> {
  await db.meta.put({ key, value })
}
