import { useMemo, useState } from 'react'
import { format, startOfWeek, addDays, subWeeks, isAfter } from 'date-fns'
import { Icon } from './Icon'
import { ProgressBar } from './ProgressBar'
import type { Habit, HabitLog, HabitSkipReason } from '../db/types'
import { computeCurrentRun, computeLongestRun } from '../lib/streak'
import { getSkipPrompt, getMostRecentReason, isInactiveTooLong, daysSinceLastLog } from '../lib/habitNudge'
import { saveHabitSkipReason } from '../db/operations'

interface Props {
  habit:         Habit
  logs:          HabitLog[]
  skipReasons:   HabitSkipReason[]
  onToggleToday: () => void
  onEdit:        () => void
}

const WEEK_COLS = 8

export function HabitGarden({ habit, logs, skipReasons, onToggleToday, onEdit }: Props) {
  const today    = format(new Date(), 'yyyy-MM-dd')
  const color    = habit.color ?? 'sage'
  const iconName = habit.icon ?? 'spark'

  const habitLogs = useMemo(
    () => logs.filter(l => l.habitId === habit.id),
    [logs, habit.id],
  )
  const logSet = useMemo(() => new Set(habitLogs.map(l => l.date)), [habitLogs])

  const habitSkipReasons = useMemo(
    () => skipReasons.filter(r => r.habitId === habit.id),
    [skipReasons, habit.id],
  )

  const lastLogDate = useMemo(() => {
    if (logSet.size === 0) return null
    return [...logSet].sort().at(-1) ?? null
  }, [logSet])

  const inactiveDays = daysSinceLastLog(today, lastLogDate)
  const showInactivityNudge = isInactiveTooLong(today, lastLogDate, habit.createdAt)

  const skipPrompt   = useMemo(
    () => getSkipPrompt(habit, today, habitLogs, habitSkipReasons),
    [habit, today, habitLogs, habitSkipReasons],
  )
  const recentReason = useMemo(() => getMostRecentReason(habitSkipReasons), [habitSkipReasons])

  const [dismissedInactivity, setDismissedInactivity] = useState(false)

  const grid = useMemo(() => {
    const todayDate  = new Date()
    const weekStart  = startOfWeek(subWeeks(todayDate, WEEK_COLS - 1), { weekStartsOn: 1 })
    return Array.from({ length: WEEK_COLS }, (_, col) =>
      Array.from({ length: 7 }, (_, row) => {
        const date    = addDays(weekStart, col * 7 + row)
        const dateStr = format(date, 'yyyy-MM-dd')
        const future  = isAfter(date, todayDate) && dateStr !== today
        return { dateStr, isToday: dateStr === today, future, done: !future && logSet.has(dateStr) }
      }),
    )
  }, [logSet, today])

  const target = habit.cadence === 'daily' ? 7 : (habit.targetPerWeek ?? 3)

  const last7 = useMemo(() => {
    let c = 0
    for (let i = 0; i < 7; i++) {
      const d = format(addDays(new Date(), -i), 'yyyy-MM-dd')
      if (logSet.has(d)) c++
    }
    return c
  }, [logSet])

  const thisWeek = useMemo(() => {
    const mon = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    let c = 0
    for (let i = 0; i < 7; i++) {
      const d = format(addDays(new Date(), -i), 'yyyy-MM-dd')
      if (d >= mon && logSet.has(d)) c++
    }
    return c
  }, [logSet])

  const run  = computeCurrentRun(today, logSet)
  const best = computeLongestRun(logSet)

  return (
    <div className="card card-pad">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div
          className="tile"
          style={{ width: 48, height: 48, '--tile-c': `var(--c-${color})` } as React.CSSProperties}
        >
          <Icon name={iconName} size={25} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{habit.name}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{last7} of last 7 days</span>
            {run > 0 && (
              <span>
                · <span style={{ color: `var(--c-${color})`, fontWeight: 600 }}>{run}-day run</span>
                {best > run && <span className="faint"> · best {best}</span>}
              </span>
            )}
          </div>
        </div>
        <button className="icon-btn" onClick={onEdit} aria-label={`Edit ${habit.name}`}>
          <Icon name="edit" size={17} />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <ProgressBar value={thisWeek} max={target} color={color} height={9} />
        </div>
        <span className="num muted" style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {thisWeek}/{target} this week
        </span>
      </div>

      {/* Garden grid */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        {/* Day labels */}
        <div className="garden-col" style={{ marginRight: 1 }}>
          {['M', '', 'W', '', 'F', '', 'S'].map((d, i) => (
            <div key={i} className="faint" style={{ height: 15, fontSize: 9, display: 'flex', alignItems: 'center' }}>
              {d}
            </div>
          ))}
        </div>
        <div className="garden-grid">
          {grid.map((week, col) => (
            <div key={col} className="garden-col">
              {week.map(cell =>
                cell.future ? (
                  <div key={cell.dateStr} style={{ width: 15, height: 15 }} />
                ) : (
                  <GCell
                    key={cell.dateStr}
                    cell={cell}
                    color={color}
                    onTap={cell.isToday ? onToggleToday : undefined}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Passive inactivity reminder — informational only, never a question.
          Per CLAUDE.md §2/§10: quiet visibility, no guilt, one-click to act or dismiss. */}
      {showInactivityNudge && !dismissedInactivity && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div className="tile" style={{ width: 34, height: 34, flexShrink: 0, '--tile-c': `var(--c-${color})` } as React.CSSProperties}>
            <Icon name="leaf" size={17} />
          </div>
          <p className="muted" style={{ flex: 1, fontSize: 13, margin: 0, lineHeight: 1.4 }}>
            {inactiveDays == null
              ? "Hasn't been tended yet — no pressure, whenever you're ready."
              : `Hasn't been tended in ${inactiveDays} days — no pressure.`}
          </p>
          <button className="btn btn-accent btn-sm" onClick={onToggleToday} style={{ flexShrink: 0 }}>
            Log it now
          </button>
          <button className="icon-btn" onClick={() => setDismissedInactivity(true)} aria-label="Dismiss">
            <Icon name="close" size={13} />
          </button>
        </div>
      )}

      {/* "What got in the way?" — cadence-aware (HabitGarden.tsx via getSkipPrompt),
          never a blocking modal, never re-asked about the same missed period twice. */}
      {skipPrompt && (
        <SkipPromptCard
          color={color}
          recentReason={recentReason}
          onSave={text => saveHabitSkipReason(habit.id, skipPrompt.periodKey, text)}
          onSkip={() => saveHabitSkipReason(habit.id, skipPrompt.periodKey, '')}
        />
      )}
    </div>
  )
}

function SkipPromptCard({
  color,
  recentReason,
  onSave,
  onSkip,
}: {
  color:        string
  recentReason: HabitSkipReason | null
  onSave:       (text: string) => void
  onSkip:       () => void
}) {
  const [text, setText] = useState('')

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div className="tile" style={{ width: 34, height: 34, flexShrink: 0, '--tile-c': `var(--c-${color})` } as React.CSSProperties}>
          <Icon name="note" size={16} />
        </div>
        <p style={{ flex: 1, fontSize: 13.5, fontWeight: 500, margin: 0 }}>What got in the way?</p>
      </div>
      {recentReason && (
        <p className="faint" style={{ fontSize: 12, margin: '0 0 8px 44px' }}>
          Last time: "{recentReason.reason}"
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginLeft: 44 }}>
        <input
          className="field"
          style={{ flex: 1 }}
          placeholder="Totally optional…"
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={150}
          onKeyDown={e => { if (e.key === 'Enter' && text.trim()) onSave(text.trim()) }}
        />
        <button className="btn btn-accent btn-sm" disabled={!text.trim()} onClick={() => onSave(text.trim())}>
          Save
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  )
}

function GCell({
  cell,
  color,
  onTap,
}: {
  cell: { dateStr: string; isToday: boolean; done: boolean }
  color: string
  onTap?: () => void
}) {
  const [bloom, setBloom] = useState(false)

  const tap = () => {
    if (!cell.done) { setBloom(true); setTimeout(() => setBloom(false), 450) }
    onTap?.()
  }

  return (
    <div
      onClick={onTap ? tap : undefined}
      className={`gcell${cell.isToday ? ' today' : ''}${bloom ? ' bloom' : ''}`}
      title={cell.dateStr}
      style={{
        background: cell.done ? `var(--c-${color})` : 'var(--surface-soft)',
        '--g-c': `var(--c-${color})`,
      } as React.CSSProperties}
    />
  )
}
