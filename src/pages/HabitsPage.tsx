import { useState } from 'react'
import { format } from 'date-fns'
import { useHabits, useHabitLogs, useHabitSkipReasons } from '../db/hooks'
import { toggleHabitLog } from '../db/operations'
import { Icon } from '../components/Icon'
import type { Habit } from '../db/types'
import { HabitGarden } from '../components/HabitGarden'
import { HabitModal }  from '../components/HabitModal'

export function HabitsPage() {
  const habits      = useHabits()
  const logs        = useHabitLogs(56)
  const skipReasons = useHabitSkipReasons()
  const [modalHabit, setModalHabit] = useState<Habit | 'new' | null>(null)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  if (!habits || !logs) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div className="page fade-up">
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="h-greet" style={{ fontSize: 27 }}>The Garden</h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14.5 }}>
            Tap today's square to log it. A quiet day doesn't undo anything — pick back up whenever you're ready.
          </p>
        </div>
        <button className="btn btn-accent" onClick={() => setModalHabit('new')}>
          <Icon name="plus" size={17} /> New habit
        </button>
      </header>

      {habits.length === 0 && (
        <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 42, marginBottom: 16 }}>🌱</div>
          <h2 style={{ fontSize: 19, marginBottom: 8 }}>Start your garden</h2>
          <p className="muted" style={{ fontSize: 14.5, marginBottom: 24, maxWidth: 300, margin: '0 auto 24px' }}>
            Add habits you want to tend. Even one small thing counts — showing up is what grows momentum.
          </p>
          <button className="btn btn-accent" onClick={() => setModalHabit('new')}>
            Plant your first habit
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18, alignItems: 'start' }}>
        {habits.map(h => (
          <HabitGarden
            key={h.id}
            habit={h}
            logs={logs}
            skipReasons={skipReasons ?? []}
            onToggleToday={() => toggleHabitLog(h.id, todayStr)}
            onEdit={() => setModalHabit(h)}
          />
        ))}
      </div>

      {modalHabit !== null && (
        <HabitModal
          habit={modalHabit === 'new' ? null : modalHabit}
          onClose={() => setModalHabit(null)}
        />
      )}
    </div>
  )
}
