export interface Habit {
  id: string
  name: string
  icon: string          // icon name from the Icon library (e.g. 'walk', 'code')
  emoji?: string        // legacy, migrated away from
  cadence: 'daily' | 'weekly' | 'flexible'
  targetPerWeek?: number
  color: string         // color name: 'sage' | 'coral' | 'lavender' | 'amber' | 'sky' | 'rose'
  createdAt: string
  archived: boolean
}

export interface HabitLog {
  id: string
  habitId: string
  date: string // yyyy-MM-dd
}

export type JobStage = 'saved' | 'applied' | 'screen' | 'interview' | 'offer' | 'rejected'

export interface StageHistoryEntry {
  stage: JobStage
  at: string // ISO timestamp
}

export interface JobApplication {
  id: string
  company: string
  role: string
  link?: string
  notes?: string
  stage: JobStage
  fitScore?: number   // 1-5 self-rated
  reframe?: string    // optional CBT reframe on rejection
  createdAt: string
  updatedAt: string
  stageHistory: StageHistoryEntry[]
}

export interface Reflection {
  id: string
  date: string // yyyy-MM-dd (one per day, upsert)
  energy: number // 1-10
  promptType: 'gratitude' | 'reframe' | 'identity'
  promptText: string
  response?: string
}

export interface MomentumSnapshot {
  date: string  // yyyy-MM-dd — primary key
  score: number // 0-100
}

export interface FocusTask {
  id: string
  title: string
  completed: boolean
  completedAt?: string
  createdAt: string
}

export interface FocusSession {
  id: string
  date: string           // yyyy-MM-dd
  taskId?: string        // optional link to a FocusTask
  taskName: string
  firstStep: string      // the smallest first move — anti-procrastination anchor
  plannedMinutes: number
  actualMinutes: number
  completed: boolean     // true = finished; false = ended early (neutral, not failure)
  distractions: string[] // captured stray thoughts during session
  notes: string          // free-text notepad written during session
  createdAt: string
  endedAt?: string
}

export interface HabitSkipReason {
  id: string
  habitId: string
  periodKey: string // daily: the missed yyyy-MM-dd. flexible/weekly: ISO week-start yyyy-MM-dd
  reason: string     // '' is valid — means "asked, user skipped" (prevents re-asking)
  createdAt: string
}

export interface Meta {
  key: string
  value: number | string | boolean
}
