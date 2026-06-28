import { useState, useMemo } from 'react'
import { format, startOfWeek, addDays } from 'date-fns'
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

  // Week stats for header
  const weekStats = useMemo(() => {
    if (!logs || !habits) return null
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const weekDays  = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'))
    const today     = format(new Date(), 'EEEE') // e.g. "Monday"
    const logDates  = new Set(logs.map(l => l.date))
    const daysActive = weekDays.filter(d => logDates.has(d)).length
    const logsThisWeek = logs.filter(l => weekDays.includes(l.date)).length
    return { daysActive, logsThisWeek, today }
  }, [logs, habits])

  if (!habits || !logs) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div className="page fade-up">

      {/* ── Page Header ── */}
      <header style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em',
              color: 'var(--ink)', margin: 0, lineHeight: 1.1,
            }}>
              The Garden
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--ink-faint)', lineHeight: 1.5, maxWidth: 380 }}>
              Each daily tend grows your plant. A quiet day doesn't undo anything — pick back up whenever you're ready.
            </p>
          </div>

          <button
            onClick={() => setModalHabit('new')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 999, border: 'none',
              background: 'var(--accent)', color: '#2a1a12',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', flexShrink: 0, marginTop: 4,
              boxShadow: '0 4px 16px rgba(167,205,175,0.22)',
            }}
          >
            <Icon name="leaf" size={16} />
            Plant a habit
          </button>
        </div>

        {/* Week stats strip */}
        {weekStats && habits.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 18, marginTop: 18,
            padding: '12px 18px', borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            fontSize: 13,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--ink-faint)' }}>Active days this week</span>
              <span style={{ color: 'var(--ink)', fontWeight: 700, marginLeft: 6 }}>{weekStats.daysActive} / 7</span>
            </div>
            <span style={{ color: 'var(--border)' }}>·</span>
            <div>
              <span style={{ color: 'var(--ink-faint)' }}>Habits tended</span>
              <span style={{ color: 'var(--ink)', fontWeight: 700, marginLeft: 6 }}>{weekStats.logsThisWeek}</span>
            </div>
            <span style={{ color: 'var(--border)' }}>·</span>
            <div>
              <span style={{ color: 'var(--ink-faint)' }}>Today</span>
              <span style={{ color: 'var(--ink)', fontWeight: 700, marginLeft: 6 }}>{weekStats.today}</span>
            </div>
          </div>
        )}
      </header>

      {/* ── Empty state ── */}
      {habits.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '52px 24px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 22,
        }}>
          <svg viewBox="0 0 80 88" width={64} height={70} style={{ marginBottom: 18, opacity: 0.7 }}>
            <ellipse cx="40" cy="82" rx="22" ry="5.5" fill="rgba(74,53,42,0.55)" />
            <rect x="37.6" y="44" width="4.8" height="34" rx="2.4" fill="#6f9e74" />
            <ellipse cx="25" cy="57" rx="14" ry="6.4" fill="#86b585" transform="rotate(-26 25 57)" />
            <ellipse cx="55" cy="51" rx="14" ry="6.4" fill="#a4c79b" transform="rotate(28 55 51)" />
            <ellipse cx="22" cy="46" rx="12" ry="5.2" fill="#7fb27f" transform="rotate(-28 22 46)" />
            <ellipse cx="58" cy="40" rx="12" ry="5.2" fill="#a8cb9f" transform="rotate(28 58 40)" />
            <circle cx="28" cy="34" r="8.8" fill="#a7cdaf" />
            <circle cx="52" cy="34" r="8.8" fill="#a7cdaf" />
            <circle cx="40" cy="25" r="8.8" fill="#a7cdaf" />
            <circle cx="40" cy="43" r="8.8" fill="#a7cdaf" />
            <circle cx="40" cy="34" r="6.8" fill="#dcb653" />
          </svg>
          <h2 style={{ fontSize: 20, margin: '0 0 10px', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            Start your garden
          </h2>
          <p style={{ fontSize: 14, color: 'var(--ink-faint)', marginBottom: 28, maxWidth: 300, margin: '0 auto 28px', lineHeight: 1.6 }}>
            Add habits you want to tend. Even one small thing counts — showing up is what grows momentum.
          </p>
          <button
            onClick={() => setModalHabit('new')}
            style={{
              padding: '11px 22px', borderRadius: 999, border: 'none',
              background: 'var(--accent)', color: '#2a1a12',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Plant your first habit
          </button>
        </div>
      )}

      {/* ── Habit cards grid ── */}
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
