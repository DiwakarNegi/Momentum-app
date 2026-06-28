import { useMemo, useState } from 'react'
import { format, parseISO, startOfWeek, addDays, isAfter } from 'date-fns'
import { Icon } from './Icon'
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

// CSS variable color names → hex (needed for SVG fills which can't use CSS vars)
const TINT: Record<string, string> = {
  sage:     '#a7cdaf',
  coral:    '#f0a594',
  lavender: '#c4b6ec',
  amber:    '#f0c578',
  sky:      '#9cc4e8',
  rose:     '#ecb3c6',
}

function withAlpha(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// Plant SVG that visually grows from a sprout to a full flower.
// Growth stage is driven by total habit completions ever (logSet.size),
// so the plant gets more elaborate as the user builds the habit over time.
function PlantGlyph({ done, totalLogs, tint, size = 30 }: {
  done:      boolean
  totalLogs: number  // total unique days logged — drives growth stage
  tint:      string  // hex accent for petals
  size?:     number
}) {
  const h = Math.round(size * 1.1)

  if (!done) {
    return (
      <svg viewBox="0 0 40 42" width={size} height={h} style={{ display: 'block', overflow: 'visible' }}>
        <ellipse cx="20" cy="39.5" rx="11" ry="2.8" fill="rgba(74,53,42,0.75)" />
        <circle cx="20" cy="37" r="1.7" fill="rgba(255,235,220,0.17)" />
      </svg>
    )
  }

  // Stages: 0 = tiny sprout | 1 = stem + small leaves | 2 = bigger leaves + bud | 3 = full bloom
  const stage = totalLogs >= 10 ? 3 : totalLogs >= 5 ? 2 : totalLogs >= 2 ? 1 : 0

  return (
    <svg viewBox="0 0 40 42" width={size} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <ellipse cx="20" cy="39.5" rx="11" ry="2.8" fill="rgba(74,53,42,0.75)" />

      {/* Stage 0: tiny sprout — bud just emerging */}
      {stage === 0 && (
        <>
          <rect x="19" y="30" width="2" height="9" rx="1" fill="#6f9e74" />
          <ellipse cx="14.5" cy="32" rx="4.5" ry="1.7" fill="#86b585" transform="rotate(-25 14.5 32)" />
          <ellipse cx="25.5" cy="30.5" rx="4.5" ry="1.7" fill="#a4c79b" transform="rotate(25 25.5 30.5)" />
          <circle cx="20" cy="29.5" r="1.6" fill={tint} opacity="0.75" />
        </>
      )}

      {/* Stage 1+: tall stem */}
      {stage >= 1 && (
        <rect x="18.8" y="22" width="2.4" height="17" rx="1.2" fill="#6f9e74" />
      )}

      {/* Stage 1: medium leaves + small bud */}
      {stage === 1 && (
        <>
          <ellipse cx="12.5" cy="28.5" rx="6.5" ry="2.8" fill="#86b585" transform="rotate(-26 12.5 28.5)" />
          <ellipse cx="27.5" cy="25.5" rx="6.5" ry="2.8" fill="#a4c79b" transform="rotate(28 27.5 25.5)" />
          <circle cx="20" cy="21.5" r="2.4" fill={tint} opacity="0.72" />
        </>
      )}

      {/* Stage 2: bigger leaves + visible bud */}
      {stage === 2 && (
        <>
          <ellipse cx="12.5" cy="28.5" rx="7" ry="3.2" fill="#86b585" transform="rotate(-26 12.5 28.5)" />
          <ellipse cx="27.5" cy="25.5" rx="7" ry="3.2" fill="#a4c79b" transform="rotate(28 27.5 25.5)" />
          <ellipse cx="11" cy="23" rx="6" ry="2.6" fill="#7fb27f" transform="rotate(-28 11 23)" />
          <ellipse cx="29" cy="20" rx="6" ry="2.6" fill="#a8cb9f" transform="rotate(28 29 20)" />
          <circle cx="20" cy="18.5" r="3.2" fill={tint} opacity="0.82" />
        </>
      )}

      {/* Stage 3: full flower in bloom */}
      {stage >= 3 && (
        <>
          <ellipse cx="12.5" cy="28.5" rx="7" ry="3.2" fill="#86b585" transform="rotate(-26 12.5 28.5)" />
          <ellipse cx="27.5" cy="25.5" rx="7" ry="3.2" fill="#a4c79b" transform="rotate(28 27.5 25.5)" />
          <ellipse cx="11" cy="23" rx="6" ry="2.6" fill="#7fb27f" transform="rotate(-28 11 23)" />
          <ellipse cx="29" cy="20" rx="6" ry="2.6" fill="#a8cb9f" transform="rotate(28 29 20)" />
          {/* petals */}
          <circle cx="14" cy="17" r="4.4" fill={tint} />
          <circle cx="26" cy="17" r="4.4" fill={tint} />
          <circle cx="20" cy="12.5" r="4.4" fill={tint} />
          <circle cx="20" cy="21.5" r="4.4" fill={tint} />
          {/* centre */}
          <circle cx="20" cy="17" r="3.4" fill="#dcb653" />
        </>
      )}
    </svg>
  )
}

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function HabitGarden({ habit, logs, skipReasons, onToggleToday, onEdit }: Props) {
  const today    = format(new Date(), 'yyyy-MM-dd')
  const color    = habit.color ?? 'sage'
  const iconName = habit.icon ?? 'spark'
  const tint     = TINT[color] ?? TINT.sage

  const habitLogs = useMemo(
    () => logs.filter(l => l.habitId === habit.id),
    [logs, habit.id],
  )
  const logSet    = useMemo(() => new Set(habitLogs.map(l => l.date)), [habitLogs])
  const totalLogs = logSet.size  // drives plant growth stage

  const habitSkipReasons = useMemo(
    () => skipReasons.filter(r => r.habitId === habit.id),
    [skipReasons, habit.id],
  )

  const lastLogDate = useMemo(() => {
    if (logSet.size === 0) return null
    const sorted = [...logSet].sort()
    return sorted[sorted.length - 1] ?? null
  }, [logSet])

  const inactiveDays       = daysSinceLastLog(today, lastLogDate)
  const showInactivityNudge = !logSet.has(today) && isInactiveTooLong(today, lastLogDate, habit.createdAt)

  const skipPrompt   = useMemo(() => getSkipPrompt(habit, today, habitLogs, habitSkipReasons), [habit, today, habitLogs, habitSkipReasons])
  const recentReason = useMemo(() => getMostRecentReason(habitSkipReasons), [habitSkipReasons])

  const pastNotes = useMemo(
    () => habitSkipReasons.filter(r => r.reason.trim().length > 0).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [habitSkipReasons],
  )

  const [dismissedInactivity, setDismissedInactivity] = useState(false)
  const [showNotes,           setShowNotes]           = useState(false)

  // Current Mon–Sun week tiles
  const weekDays = useMemo(() => {
    const now       = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => {
      const date    = addDays(weekStart, i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const isFuture = isAfter(date, now) && dateStr !== today
      return {
        dateStr,
        label:   WEEK_LABELS[i],
        isToday: dateStr === today,
        isFuture,
        done:    !isFuture && logSet.has(dateStr),
      }
    })
  }, [logSet, today])

  const todayDone  = logSet.has(today)
  const target     = habit.cadence === 'daily' ? 7 : (habit.targetPerWeek ?? 3)
  const weekDone   = weekDays.filter(d => d.done).length
  const run        = computeCurrentRun(today, logSet)
  const best       = computeLongestRun(logSet)

  return (
    <div style={{
      background:    'var(--surface)',
      border:        '1px solid var(--border)',
      borderRadius:  22,
      padding:       24,
      display:       'flex',
      flexDirection: 'column',
      gap:           18,
      position:      'relative',
      overflow:      'hidden',
      boxShadow:     'var(--shadow-card)',
    }}>
      {/* Ambient colour wash — CLAUDE.md §7: visual metaphor, per-habit personalisation */}
      <div style={{
        position: 'absolute', top: -30, right: -30, width: 190, height: 190,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${withAlpha(tint, 0.09)}, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 13, flexShrink: 0,
          background: withAlpha(tint, 0.16),
          border: `1px solid ${withAlpha(tint, 0.28)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: tint,
        }}>
          <Icon name={iconName} size={22} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
            {habit.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--ink-faint)', marginTop: 3, flexWrap: 'wrap' }}>
            {run > 0 && (
              <span style={{ color: tint, fontWeight: 600 }}>{run}-day run</span>
            )}
            {run > 0 && <span style={{ opacity: 0.4 }}>·</span>}
            <span>{weekDone} of {target} this week</span>
            {best > run && run > 0 && (
              <><span style={{ opacity: 0.4 }}>·</span><span>best {best}</span></>
            )}
          </div>
        </div>

        <button
          onClick={onEdit}
          style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: 'var(--surface-soft)', border: '1px solid var(--border)',
            color: 'var(--ink-muted)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer',
          }}
          aria-label={`Edit ${habit.name}`}
        >
          <Icon name="edit" size={14} />
        </button>
      </div>

      {/* ── Week plant visualization ── */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
        {weekDays.map(day => {
          const clickable = day.isToday && !day.isFuture
          return (
            <div
              key={day.dateStr}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}
            >
              <div
                onClick={clickable ? onToggleToday : undefined}
                title={day.dateStr}
                style={{
                  width:  '100%',
                  aspectRatio: '1 / 1.12',
                  borderRadius: 14,
                  background: day.done
                    ? `linear-gradient(180deg, ${withAlpha(tint, 0.13)}, ${withAlpha(tint, 0.04)})`
                    : day.isToday
                      ? withAlpha(tint, 0.06)
                      : 'rgba(255,235,220,0.025)',
                  border: day.isToday
                    ? `1.5px dashed ${tint}`
                    : '1px solid rgba(255,235,220,0.06)',
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                  padding:    5,
                  cursor:     clickable ? 'pointer' : 'default',
                  opacity:    day.isFuture ? 0.3 : 1,
                  transition: 'all .2s ease',
                  position:   'relative',
                }}
              >
                {day.isToday && !day.done ? (
                  // Today not yet tended — invite the tap
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: tint, fontSize: 17, fontWeight: 300, opacity: 0.55,
                  }}>
                    +
                  </div>
                ) : (
                  <PlantGlyph done={day.done} totalLogs={totalLogs} tint={tint} size={28} />
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                color: day.isToday ? tint : 'var(--ink-faint)',
              }}>
                {day.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── Footer: Tend / Tended ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        paddingTop: 14, borderTop: '1px solid rgba(255,235,220,0.05)',
      }}>
        {todayDone ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: withAlpha(tint, 0.18),
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: tint,
              }}>
                <Icon name="check" size={13} stroke={2.5} />
              </div>
              <span style={{ fontSize: 13.5, color: 'var(--ink-muted)' }}>Tended today. Nice.</span>
            </div>
            <button
              onClick={onToggleToday}
              style={{
                padding: '7px 13px', borderRadius: 999, fontSize: 13, fontFamily: 'var(--font-body)',
                background: 'transparent', border: '1px solid rgba(255,235,220,0.10)',
                color: 'var(--ink-muted)', cursor: 'pointer',
              }}
            >
              Undo
            </button>
          </>
        ) : (
          <>
            <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink-muted)' }}>
              {run >= 2
                ? `You're on ${run}. One small tend keeps it going.`
                : 'What\'s one small thing you can do today?'}
            </span>
            <button
              onClick={onToggleToday}
              style={{
                padding: '9px 16px', borderRadius: 999, border: 'none',
                fontFamily: 'var(--font-body)', background: tint, color: '#2a1a12',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                boxShadow: `0 4px 14px ${withAlpha(tint, 0.22)}`,
              }}
            >
              Tend today
            </button>
          </>
        )}
      </div>

      {/* ── Passive inactivity reminder — informational only, never guilt.
          Per CLAUDE.md §2/§10: quiet, one-click act or dismiss, no red. ── */}
      {showInactivityNudge && !dismissedInactivity && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 14, borderTop: '1px solid rgba(255,235,220,0.05)' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: withAlpha(tint, 0.14), color: tint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="leaf" size={16} />
          </div>
          <p style={{ flex: 1, fontSize: 13, margin: 0, lineHeight: 1.4, color: 'var(--ink-muted)' }}>
            {inactiveDays == null
              ? "Hasn't been tended yet — no pressure, whenever you're ready."
              : `Hasn't been tended in ${inactiveDays} days — no pressure.`}
          </p>
          <button
            style={{
              padding: '7px 13px', borderRadius: 999, border: 'none',
              background: tint, color: '#2a1a12', fontFamily: 'var(--font-body)',
              fontWeight: 700, fontSize: 12.5, cursor: 'pointer', flexShrink: 0,
            }}
            onClick={onToggleToday}
          >
            Log it now
          </button>
          <button className="icon-btn" onClick={() => setDismissedInactivity(true)} aria-label="Dismiss" style={{ width: 28, height: 28 }}>
            <Icon name="close" size={12} />
          </button>
        </div>
      )}

      {/* ── "What got in the way?" — cadence-aware, never blocking, never re-asked.
          Per CLAUDE.md §10: inline card, dismiss = one click, no modal. ── */}
      {skipPrompt && (
        <SkipPromptCard
          tint={tint}
          recentReason={recentReason}
          onSave={text  => saveHabitSkipReason(habit.id, skipPrompt.periodKey, text)}
          onSkip={() => saveHabitSkipReason(habit.id, skipPrompt.periodKey, '')}
        />
      )}

      {/* Past notes */}
      {pastNotes.length > 0 && (
        <div style={{ paddingTop: 14, borderTop: '1px solid rgba(255,235,220,0.05)' }}>
          <button
            onClick={() => setShowNotes(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12.5, color: 'var(--ink-faint)',
              display: 'flex', alignItems: 'center', gap: 5, padding: 0,
            }}
          >
            <span style={{ transform: showNotes ? 'rotate(90deg)' : 'none', display: 'inline-flex', transition: 'transform .15s' }}>
              <Icon name="chevronRight" size={13} />
            </span>
            {pastNotes.length} note{pastNotes.length > 1 ? 's' : ''}
          </button>
          {showNotes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {pastNotes.map(n => (
                <div key={n.id} style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                  <span style={{ color: 'var(--ink-faint)' }}>{noteDateLabel(habit.cadence, n.periodKey)}</span>
                  {' — '}
                  <span style={{ color: 'var(--ink-muted)' }}>{n.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function noteDateLabel(cadence: Habit['cadence'], periodKey: string): string {
  const label = format(parseISO(periodKey), 'MMM d')
  return cadence === 'daily' ? label : `Week of ${label}`
}

function SkipPromptCard({
  tint,
  recentReason,
  onSave,
  onSkip,
}: {
  tint:         string
  recentReason: HabitSkipReason | null
  onSave:       (text: string) => void
  onSkip:       () => void
}) {
  const [text, setText] = useState('')

  return (
    <div style={{ paddingTop: 14, borderTop: '1px solid rgba(255,235,220,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: withAlpha(tint, 0.14), color: tint,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="note" size={15} />
        </div>
        <p style={{ flex: 1, fontSize: 13.5, fontWeight: 500, margin: 0, color: 'var(--ink)' }}>
          What got in the way?
        </p>
      </div>
      {recentReason && (
        <p style={{ fontSize: 12, margin: '0 0 8px 42px', color: 'var(--ink-faint)' }}>
          Last time: "{recentReason.reason}"
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginLeft: 42 }}>
        <input
          name="skip-reason"
          className="field"
          style={{ flex: 1 }}
          placeholder="Totally optional…"
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={150}
          onKeyDown={e => { if (e.key === 'Enter' && text.trim()) onSave(text.trim()) }}
        />
        <button
          style={{
            padding: '7px 13px', borderRadius: 999, border: 'none',
            background: tint, color: '#2a1a12', fontFamily: 'var(--font-body)',
            fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
            opacity: text.trim() ? 1 : 0.4,
          }}
          disabled={!text.trim()}
          onClick={() => onSave(text.trim())}
        >
          Save
        </button>
        <button
          style={{
            padding: '7px 13px', borderRadius: 999,
            background: 'transparent', border: '1px solid rgba(255,235,220,0.10)',
            color: 'var(--ink-muted)', fontFamily: 'var(--font-body)', fontSize: 12.5, cursor: 'pointer',
          }}
          onClick={onSkip}
        >
          Skip
        </button>
      </div>
    </div>
  )
}
