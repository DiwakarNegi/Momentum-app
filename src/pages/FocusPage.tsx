import { useState, useEffect, useRef, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { Icon } from '../components/Icon'
import { useFocusSessions, useFocusTasks } from '../db/hooks'
import {
  saveFocusSession, deleteFocusSession,
  addFocusTask, toggleFocusTask, deleteFocusTask,
  clearCompletedFocusTasks, updateFocusTaskTitle,
} from '../db/operations'
import type { FocusSession, FocusTask } from '../db/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'setup' | 'active' | 'paused' | 'break' | 'done'

interface Draft {
  taskName:       string
  firstStep:      string
  plannedMinutes: number
  taskId?:        string   // set when launched from a task card
}

const DURATIONS = [5, 15, 25, 50]

// ─── Timer orb helpers ────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return Math.round(a + (b - a) * t) }

function timerRGB(pct: number): [number, number, number] {
  const S: [number,number,number] = [167, 212, 175]  // sage — calm, plenty of time
  const A: [number,number,number] = [232, 194, 121]  // amber — in the zone
  const C: [number,number,number] = [232, 160, 143]  // coral — home stretch
  if (pct > 66) {
    const t = (100 - pct) / 34
    return [lerp(S[0],A[0],t), lerp(S[1],A[1],t), lerp(S[2],A[2],t)]
  }
  if (pct > 33) {
    const t = 1 - (pct - 33) / 33
    return [lerp(A[0],C[0],t), lerp(A[1],C[1],t), lerp(A[2],C[2],t)]
  }
  return C
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

const WAVE_A = 'M0,24 C30,15 60,15 90,24 C120,33 150,33 180,24 C210,15 240,15 270,24 C300,33 330,33 360,24 L360,48 L0,48 Z'
const WAVE_B = 'M0,24 C30,31 60,31 90,24 C120,17 150,17 180,24 C210,31 240,31 270,24 C300,17 330,17 360,24 L360,48 L0,48 Z'

// ─── Break duration heuristic ─────────────────────────────────────────────────

function breakMinutesFor(plannedMinutes: number) {
  if (plannedMinutes >= 45) return 10
  if (plannedMinutes >= 20) return 5
  return 3
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FocusPage() {
  const [phase, setPhase]   = useState<Phase>('idle')
  const [draft, setDraft]   = useState<Draft>({ taskName: '', firstStep: '', plannedMinutes: 25 })

  const [totalSeconds,    setTotalSeconds]    = useState(0)
  const [secondsLeft,     setSecondsLeft]     = useState(0)
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(0)
  const [notes,           setNotes]           = useState('')
  const [distractions,    setDistractions]    = useState<string[]>([])
  const [captureText,     setCaptureText]     = useState('')
  const [showCapture,     setShowCapture]     = useState(false)
  const [showNotepad,     setShowNotepad]     = useState(false)
  const [savedSession,    setSavedSession]    = useState<FocusSession | null>(null)

  const intervalRef      = useRef<number | null>(null)
  const breakIntervalRef = useRef<number | null>(null)
  const sessions         = useFocusSessions(7)
  const tasks            = useFocusTasks()

  useEffect(() => () => {
    if (intervalRef.current)      clearInterval(intervalRef.current)
    if (breakIntervalRef.current) clearInterval(breakIntervalRef.current)
  }, [])

  function stopTicking() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  function stopBreak() {
    if (breakIntervalRef.current) { clearInterval(breakIntervalRef.current); breakIntervalRef.current = null }
  }

  const handleTimerDone = useCallback(async (completed: boolean, remaining: number) => {
    stopTicking()
    const actual  = Math.max(1, Math.ceil((totalSeconds - remaining) / 60))
    const session = await saveFocusSession({
      taskId:         draft.taskId,
      taskName:       draft.taskName,
      firstStep:      draft.firstStep,
      plannedMinutes: draft.plannedMinutes,
      actualMinutes:  actual,
      completed,
      distractions,
      notes,
    })
    setSavedSession(session)

    if (completed) {
      // Natural end → break phase before done
      const breakSecs = breakMinutesFor(draft.plannedMinutes) * 60
      setBreakSecondsLeft(breakSecs)
      setPhase('break')
      breakIntervalRef.current = window.setInterval(() => {
        setBreakSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(breakIntervalRef.current!)
            breakIntervalRef.current = null
            setTimeout(() => setPhase('done'), 50)
            return 0
          }
          return s - 1
        })
      }, 1000)
    } else {
      // Manual end → skip break, go straight to done
      setPhase('done')
    }
  }, [totalSeconds, draft, distractions, notes]) // eslint-disable-line

  function startTicking() {
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          setTimeout(() => handleTimerDone(true, 0), 50)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  function beginSession() {
    const secs = draft.plannedMinutes * 60
    setTotalSeconds(secs)
    setSecondsLeft(secs)
    setNotes('')
    setDistractions([])
    setCaptureText('')
    setShowCapture(false)
    setShowNotepad(false)
    setSavedSession(null)
    setPhase('active')
    setTimeout(startTicking, 0)
  }

  function launchFromTask(task: FocusTask) {
    setDraft({ taskName: task.title, firstStep: '', plannedMinutes: 25, taskId: task.id })
    setPhase('setup')
  }

  function pauseSession()  { stopTicking(); setPhase('paused') }
  function resumeSession() { setPhase('active'); startTicking() }

  function captureDistraction() {
    if (!captureText.trim()) return
    setDistractions(prev => [...prev, captureText.trim()])
    setCaptureText('')
    setShowCapture(false)
  }

  function resetToIdle() {
    stopTicking()
    stopBreak()
    setPhase('idle')
    setNotes('')
    setDistractions([])
    setSavedSession(null)
    setDraft({ taskName: '', firstStep: '', plannedMinutes: 25 })
  }

  // Called from break screen: skip break, start the same session again immediately
  function startAnotherRound() {
    stopBreak()
    beginSession()
  }

  // Called from break screen: skip break, go to done summary
  function endBreak() {
    stopBreak()
    setPhase('done')
  }

  // ── Setup ──────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return <SetupScreen draft={draft} setDraft={setDraft} onStart={beginSession} onBack={() => setPhase('idle')} />
  }

  // ── Active / Paused ────────────────────────────────────────────────────────
  if (phase === 'active' || phase === 'paused') {
    const pct = totalSeconds > 0 ? Math.round((secondsLeft / totalSeconds) * 100) : 0
    const [r, g, b] = timerRGB(pct)
    const fill = `rgb(${r},${g},${b})`
    const glow = `rgba(${r},${g},${b},0.38)`

    return (
      <div className="page fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 480, marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 5 }}>Focus session · {draft.plannedMinutes} min</div>
          <div style={{ fontWeight: 600, fontSize: 17 }}>{draft.taskName}</div>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="arrowRight" size={14} /><em>{draft.firstStep}</em>
          </div>
        </div>

        <div className="orb-wrap" style={{ width: 200, marginBottom: 28 }}>
          <div className="orb-breathe" style={{ width: 200, height: 200, boxShadow: `0 0 50px 0 ${glow}, 0 0 0 1px var(--border)` }}>
            <div className="orb-inner" style={{ width: 200, height: 200 }}>
              <div className="orb-fill" style={{ height: `${pct}%`, background: `linear-gradient(180deg, ${fill} 0%, rgba(${r},${g},${b},0.75) 100%)`, transition: 'height 1s linear, background 1s linear' }} />
              <div className="orb-bubbles" style={{ height: `${pct}%` }}>
                {pct > 10 && <span className="orb-bubble" style={{ left: '30%', width: 5, height: 5, '--d': '6s', '--delay': '0s', '--h': '120px' } as React.CSSProperties} />}
                {pct > 25 && <span className="orb-bubble" style={{ left: '62%', width: 4, height: 4, '--d': '7.5s', '--delay': '2.1s', '--h': '140px' } as React.CSSProperties} />}
              </div>
              <div className="orb-wave" style={{ bottom: `calc(${pct}% - 24px)` }}>
                <svg viewBox="0 0 360 48" preserveAspectRatio="none" className="orb-wave-svg"><path d={WAVE_A} fill={fill} /></svg>
                <svg viewBox="0 0 360 48" preserveAspectRatio="none" className="orb-wave-svg orb-wave-2"><path d={WAVE_B} fill={fill} /></svg>
              </div>
              <div className="orb-sheen" />
              <div className="orb-readout">
                <span className="orb-num" style={{ fontSize: 40 }}>{fmt(secondsLeft)}</span>
                <span className="orb-label">{phase === 'paused' ? 'paused' : 'remaining'}</span>
              </div>
            </div>
          </div>
        </div>

        {distractions.length > 0 && (
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="lightning" size={13} />{distractions.length} thought{distractions.length > 1 ? 's' : ''} parked
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCapture(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="lightning" size={15} /> Distracted?
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowNotepad(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="note" size={15} /> Notes
          </button>
        </div>

        {showCapture && (
          <div className="card card-pad" style={{ width: '100%', maxWidth: 480, marginBottom: 12, display: 'flex', gap: 8 }}>
            <input id="capture-thought" name="capture" className="field" style={{ flex: 1 }} placeholder="Park the thought, stay in the session…" value={captureText} onChange={e => setCaptureText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') captureDistraction() }} autoFocus maxLength={200} />
            <button className="btn btn-accent btn-sm" onClick={captureDistraction}>Park it</button>
          </div>
        )}

        {showNotepad && (
          <div className="card card-pad" style={{ width: '100%', maxWidth: 480, marginBottom: 12 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Session notes</div>
            <textarea id="session-notes" name="notes" className="field" style={{ width: '100%', boxSizing: 'border-box', minHeight: 100, resize: 'vertical' }} placeholder="Jot anything down — ideas, links, things to follow up on…" value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {phase === 'active' ? (
            <button className="btn btn-ghost" onClick={pauseSession} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Icon name="pause" size={16} /> Pause
            </button>
          ) : (
            <button className="btn btn-accent" onClick={resumeSession} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Icon name="play" size={16} /> Resume
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => handleTimerDone(false, secondsLeft)} style={{ color: 'var(--ink-muted)' }}>
            End session
          </button>
        </div>
      </div>
    )
  }

  // ── Break ──────────────────────────────────────────────────────────────────
  if (phase === 'break' && savedSession) {
    return (
      <BreakScreen
        session={savedSession}
        draft={draft}
        breakSecondsLeft={breakSecondsLeft}
        onEndHere={endBreak}
        onStartAnother={startAnotherRound}
      />
    )
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (phase === 'done' && savedSession) {
    const linkedTask = tasks?.find(t => t.id === savedSession.taskId && !t.completed)
    return (
      <DoneScreen
        session={savedSession}
        linkedTask={linkedTask}
        onStartAnother={() => { setDraft({ taskName: '', firstStep: '', plannedMinutes: 25 }); setPhase('setup') }}
        onBack={resetToIdle}
      />
    )
  }

  // ── Idle ───────────────────────────────────────────────────────────────────
  const todayDateStr = format(new Date(), 'yyyy-MM-dd')
  const incomplete = tasks?.filter(t => !t.completed) ?? []
  const complete   = tasks?.filter(t => t.completed)  ?? []
  const todaySessions = sessions?.filter(s => s.date === todayDateStr) ?? []
  const pastSessions  = sessions?.filter(s => s.date !== todayDateStr) ?? []

  return (
    <div className="page fade-up">
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="h-greet" style={{ fontSize: 27 }}>Focus</h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14.5 }}>Name the task, shrink the first step, start the clock.</p>
        </div>
        <button className="btn btn-accent" onClick={() => setPhase('setup')} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="play" size={16} /> New session
        </button>
      </header>

      {/* ── Task list ──────────────────────────────────────────────────────── */}
      <TaskList
        incomplete={incomplete}
        complete={complete}
        todayDateStr={todayDateStr}
        onLaunch={launchFromTask}
      />

      {/* ── Today's sessions ────────────────────────────────────────────────── */}
      {todaySessions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Today's sessions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {todaySessions.map(s => <SessionCard key={s.id} session={s} onDelete={() => deleteFocusSession(s.id)} />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(sessions?.length ?? 0) === 0 && (tasks?.length ?? 0) === 0 && (
        <div className="card card-pad" style={{ textAlign: 'center', padding: '52px 24px' }}>
          <div className="tile" style={{ width: 56, height: 56, margin: '0 auto 16px', '--tile-c': 'var(--c-sky)' } as React.CSSProperties}>
            <Icon name="focus" size={28} />
          </div>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Start your first session</h2>
          <p className="muted" style={{ fontSize: 14, maxWidth: 300, margin: '0 auto 24px', lineHeight: 1.6 }}>
            Add tasks above or jump straight into a session — name the task, shrink it to a first move, and let the timer give you permission to begin.
          </p>
          <button className="btn btn-accent" onClick={() => setPhase('setup')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Icon name="play" size={16} /> Start a session
          </button>
        </div>
      )}

      {/* Past sessions */}
      {pastSessions.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Recent sessions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pastSessions.map(s => <SessionCard key={s.id} session={s} onDelete={() => deleteFocusSession(s.id)} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Task list ────────────────────────────────────────────────────────────────

function TaskList({ incomplete, complete, todayDateStr, onLaunch }: {
  incomplete:   FocusTask[]
  complete:     FocusTask[]
  todayDateStr: string
  onLaunch:     (task: FocusTask) => void
}) {
  const [input,    setInput]    = useState('')
  const [showDone, setShowDone] = useState(false)

  const carriedOver = incomplete.filter(t => !t.createdAt.startsWith(todayDateStr))
  const addedToday  = incomplete.filter(t =>  t.createdAt.startsWith(todayDateStr))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    await addFocusTask(input)
    setInput('')
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="eyebrow">Tasks</div>
        {complete.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11.5, padding: '4px 10px' }}
            onClick={clearCompletedFocusTasks}
          >
            Clear done
          </button>
        )}
      </div>

      {/* Quick-add input */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: incomplete.length + complete.length > 0 ? 12 : 0 }}>
        <input
          id="focus-task-add"
          name="task"
          className="field"
          style={{ flex: 1 }}
          placeholder="Add a task for today…"
          value={input}
          onChange={e => setInput(e.target.value)}
          maxLength={120}
        />
        <button className="btn btn-ghost btn-sm" type="submit" disabled={!input.trim()} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="plus" size={15} /> Add
        </button>
      </form>

      {/* Carried-over tasks — showcased first, calm framing (never "overdue") */}
      {carriedOver.length > 0 && (
        <div style={{ marginBottom: addedToday.length > 0 ? 14 : 4 }}>
          <div className="faint" style={{ fontSize: 11.5, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Still open
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {carriedOver.map(t => (
              <TaskRow key={t.id} task={t} onLaunch={() => onLaunch(t)} />
            ))}
          </div>
        </div>
      )}

      {/* Today's tasks */}
      {addedToday.length > 0 && (
        <div>
          {carriedOver.length > 0 && (
            <div className="faint" style={{ fontSize: 11.5, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Added today
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {addedToday.map(t => (
              <TaskRow key={t.id} task={t} onLaunch={() => onLaunch(t)} />
            ))}
          </div>
        </div>
      )}

      {/* Completed tasks toggle */}
      {complete.length > 0 && (
        <div style={{ marginTop: incomplete.length > 0 ? 10 : 0 }}>
          <button
            onClick={() => setShowDone(v => !v)}
            className="faint"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 0' }}
          >
            <span style={{ transform: showDone ? 'rotate(90deg)' : 'none', display: 'inline-flex', transition: 'transform .15s' }}>
              <Icon name="chevronRight" size={13} />
            </span>
            {complete.length} done
          </button>
          {showDone && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              {complete.map(t => <TaskRow key={t.id} task={t} onLaunch={() => onLaunch(t)} />)}
            </div>
          )}
        </div>
      )}

      {incomplete.length === 0 && complete.length === 0 && (
        <p className="faint" style={{ fontSize: 13, margin: 0 }}>No tasks yet — add one above to get started.</p>
      )}
    </div>
  )
}

// ─── Individual task row ──────────────────────────────────────────────────────

function TaskRow({ task, onLaunch }: { task: FocusTask; onLaunch: () => void }) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState(task.title)

  async function commitEdit() {
    if (val.trim() && val.trim() !== task.title) await updateFocusTaskTitle(task.id, val)
    setEditing(false)
  }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 0', borderBottom: '1px solid var(--border)',
      }}
      onMouseLeave={() => { if (editing) commitEdit() }}
    >
      {/* Checkbox */}
      <button
        onClick={() => toggleFocusTask(task.id)}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        style={{
          flexShrink: 0, width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
          border: task.completed ? 'none' : '2px solid var(--border)',
          background: task.completed ? 'var(--c-sage)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .15s',
        }}
      >
        {task.completed && <Icon name="check" size={11} style={{ color: '#fff' }} />}
      </button>

      {/* Title */}
      {editing ? (
        <input
          id={`task-edit-${task.id}`}
          name="task-title"
          className="field"
          style={{ flex: 1, padding: '3px 8px', fontSize: 14 }}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setVal(task.title); setEditing(false) } }}
          autoFocus
          maxLength={120}
        />
      ) : (
        <span
          style={{
            flex: 1, fontSize: 14, lineHeight: 1.35, cursor: 'text',
            textDecoration: task.completed ? 'line-through' : 'none',
            color: task.completed ? 'var(--ink-faint)' : 'var(--ink)',
          }}
          onDoubleClick={() => { if (!task.completed) { setVal(task.title); setEditing(true) } }}
        >
          {task.title}
        </span>
      )}

      {/* Actions */}
      {!task.completed && (
        <button
          className="btn btn-accent btn-sm"
          onClick={onLaunch}
          title="Start a focus session on this task"
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px' }}
        >
          <Icon name="play" size={13} /> Focus
        </button>
      )}
      <button
        className="icon-btn"
        onClick={() => deleteFocusTask(task.id)}
        aria-label="Delete task"
        style={{ flexShrink: 0, opacity: 0.5 }}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  )
}

// ─── Setup screen ─────────────────────────────────────────────────────────────

function SetupScreen({ draft, setDraft, onStart, onBack }: {
  draft:    Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  onStart:  () => void
  onBack:   () => void
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(p => ({ ...p, [k]: v }))

  function adjustMinutes(delta: number) {
    set('plannedMinutes', Math.max(1, Math.min(180, draft.plannedMinutes + delta)))
  }

  return (
    <div className="page fade-up" style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26 }}>
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <h1 className="h-greet" style={{ fontSize: 24, margin: 0 }}>Set up your session</h1>
      </div>

      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 9 }}>What are you working on?</div>
          <input
            id="session-task-name"
            name="task-name"
            className="field"
            style={{ width: '100%', boxSizing: 'border-box' }}
            placeholder="e.g. Portfolio intro, cover letter for Acme…"
            value={draft.taskName}
            onChange={e => set('taskName', e.target.value)}
            autoFocus={!draft.taskName}
            maxLength={100}
          />
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 5 }}>Smallest first move <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(optional)</span></div>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 9, lineHeight: 1.55 }}>
            Just the one thing that breaks the ice — "open the doc" counts. Skip if you're ready to go.
          </p>
          <input
            id="session-first-step"
            name="first-step"
            className="field"
            style={{ width: '100%', boxSizing: 'border-box' }}
            placeholder="e.g. Open the file and write one sentence…"
            value={draft.firstStep}
            onChange={e => set('firstStep', e.target.value)}
            autoFocus={!!draft.taskName}
            maxLength={150}
          />
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 9 }}>How long?</div>

          {/* Preset chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={() => set('plannedMinutes', d)}
                style={{
                  flex: '1 1 0', minWidth: 52, padding: '10px 0', borderRadius: 14, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', border: 'none', transition: 'all .15s',
                  background: draft.plannedMinutes === d ? 'var(--accent)' : 'var(--surface-soft)',
                  color:      draft.plannedMinutes === d ? 'var(--on-accent)' : 'var(--ink-muted)',
                  boxShadow:  draft.plannedMinutes === d ? `0 0 16px -4px var(--accent)` : 'none',
                }}
                aria-pressed={draft.plannedMinutes === d}
              >
                {d} min
              </button>
            ))}
          </div>

          {/* Custom stepper — replaces the cheap browser number spinners */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <span className="muted" style={{ fontSize: 13 }}>Custom:</span>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              border: '1.5px solid var(--border)', borderRadius: 12,
              background: 'var(--surface-soft)',
            }}>
              <button
                type="button"
                onClick={() => adjustMinutes(-1)}
                aria-label="Decrease by 1 minute"
                style={{
                  width: 36, height: 36, border: 'none', background: 'transparent',
                  cursor: 'pointer', fontSize: 18, color: 'var(--ink-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '12px 0 0 12px',
                }}
              >−</button>
              <input
                id="session-duration"
                name="planned-minutes"
                type="number"
                min={1} max={180}
                value={draft.plannedMinutes}
                onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1 && v <= 180) set('plannedMinutes', v) }}
                className="stepper-input"
                style={{
                  width: 44, border: 'none', background: 'transparent',
                  textAlign: 'center', fontSize: 14, fontWeight: 600,
                  color: 'var(--ink)', outline: 'none',
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--ink-faint)', paddingRight: 4 }}>min</span>
              <button
                type="button"
                onClick={() => adjustMinutes(1)}
                aria-label="Increase by 1 minute"
                style={{
                  width: 36, height: 36, border: 'none', background: 'transparent',
                  cursor: 'pointer', fontSize: 18, color: 'var(--ink-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '0 12px 12px 0',
                }}
              >+</button>
            </div>
          </div>
        </div>
      </div>

      <button
        className="btn btn-accent"
        style={{ width: '100%', marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={onStart}
        disabled={!draft.taskName.trim()}
      >
        <Icon name="play" size={17} /> Start session
      </button>
    </div>
  )
}

// ─── Break screen ─────────────────────────────────────────────────────────────

function BreakScreen({ session, draft, breakSecondsLeft, onEndHere, onStartAnother }: {
  session:          FocusSession
  draft:            Draft
  breakSecondsLeft: number
  onEndHere:        () => void
  onStartAnother:   () => void
}) {
  return (
    <div className="page fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>☕</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Break time</h1>
        <p className="muted" style={{ fontSize: 14 }}>
          Nice work — {session.actualMinutes} min on "{session.taskName}"
        </p>
      </div>

      {/* Soft countdown ring */}
      <div style={{
        width: 148, height: 148, borderRadius: '50%',
        border: '3px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        marginBottom: 32,
        background: 'var(--surface-soft)',
        boxShadow: '0 0 32px -8px var(--c-sage)',
      }}>
        <span style={{ fontSize: 34, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--c-sage)', letterSpacing: '-1px' }}>
          {fmt(breakSecondsLeft)}
        </span>
        <span className="muted" style={{ fontSize: 12, marginTop: 2 }}>break</span>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost" onClick={onEndHere}>End here</button>
        <button
          className="btn btn-accent"
          onClick={onStartAnother}
          style={{ display: 'flex', alignItems: 'center', gap: 7 }}
        >
          <Icon name="play" size={15} /> {draft.plannedMinutes} min again
        </button>
      </div>

      <p className="muted" style={{ fontSize: 12.5, marginTop: 18, textAlign: 'center', maxWidth: 260, lineHeight: 1.6 }}>
        Break ends automatically — or jump back in when you're ready.
      </p>
    </div>
  )
}

// ─── Done screen ──────────────────────────────────────────────────────────────

function DoneScreen({ session, linkedTask, onStartAnother, onBack }: {
  session:        FocusSession
  linkedTask?:    FocusTask
  onStartAnother: () => void
  onBack:         () => void
}) {
  const [markedDone, setMarkedDone] = useState(false)

  async function handleMarkDone() {
    if (!linkedTask) return
    await toggleFocusTask(linkedTask.id)
    setMarkedDone(true)
  }

  return (
    <div className="page fade-up" style={{ maxWidth: 520 }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div className="tile" style={{ width: 60, height: 60, margin: '0 auto 16px', '--tile-c': session.completed ? 'var(--c-sage)' : 'var(--c-amber)' } as React.CSSProperties}>
          <Icon name={session.completed ? 'check' : 'focus'} size={30} />
        </div>
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>
          {session.completed ? 'Session complete!' : 'Session ended'}
        </h1>
        <p className="muted" style={{ fontSize: 14 }}>
          {session.actualMinutes} min focused · {session.completed ? 'Full session' : 'Ended early — still counts'}
        </p>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: linkedTask || session.distractions.length > 0 || session.notes ? 16 : 0 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Task</div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{session.taskName}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="arrowRight" size={13} /> {session.firstStep}
          </div>
        </div>

        {/* Mark task done prompt */}
        {linkedTask && !markedDone && (
          <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', marginBottom: session.distractions.length > 0 || session.notes ? 14 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 13.5 }}>Mark "{linkedTask.title}" as done?</span>
              <button className="btn btn-accent btn-sm" onClick={handleMarkDone} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="check" size={13} /> Done
              </button>
            </div>
          </div>
        )}
        {linkedTask && markedDone && (
          <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 7, color: 'var(--c-sage)', fontSize: 13.5, marginBottom: session.distractions.length > 0 || session.notes ? 14 : 0 }}>
            <Icon name="check" size={15} /> Task marked as done
          </div>
        )}

        {session.distractions.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: session.notes ? 14 : 0 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              <Icon name="lightning" size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Parked thoughts
            </div>
            {session.distractions.map((d, i) => (
              <div key={i} className="muted" style={{ fontSize: 13.5, display: 'flex', gap: 8 }}><span>·</span>{d}</div>
            ))}
          </div>
        )}

        {session.notes && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              <Icon name="note" size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Notes
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>{session.notes}</p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onBack}>Back</button>
        <button className="btn btn-accent" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }} onClick={onStartAnother}>
          <Icon name="play" size={15} /> Start another
        </button>
      </div>
    </div>
  )
}

// ─── Session history card ─────────────────────────────────────────────────────

function SessionCard({ session, onDelete }: { session: FocusSession; onDelete: () => void }) {
  const [open,    setOpen]    = useState(false)
  const [confirm, setConfirm] = useState(false)

  const dateLabel = (() => {
    const diff = Math.round((new Date().setHours(0,0,0,0) - new Date(session.date).setHours(0,0,0,0)) / 86_400_000)
    if (diff === 1) return 'Yesterday'
    if (diff < 7)   return `${diff} days ago`
    return format(parseISO(session.date), 'MMM d')
  })()

  return (
    <div className="card" style={{ borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div className="tile" style={{ width: 36, height: 36, flexShrink: 0, '--tile-c': session.completed ? 'var(--c-sage)' : 'var(--c-amber)' } as React.CSSProperties}>
          <Icon name={session.completed ? 'check' : 'focus'} size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.taskName}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>{dateLabel}</span><span>·</span><span>{session.actualMinutes} min</span>
            {session.distractions.length > 0 && <><span>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="lightning" size={11} />{session.distractions.length}</span></>}
            {session.notes && <><span>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="note" size={11} />note</span></>}
          </div>
        </div>
        <span className="faint" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', display: 'inline-flex' }}>
          <Icon name="chevronDown" size={14} />
        </span>
      </div>

      {open && (
        <div style={{ padding: '4px 16px 14px', borderTop: '1px solid var(--border)' }}>
          {session.firstStep && (
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="arrowRight" size={13} /><em>{session.firstStep}</em>
            </div>
          )}
          {session.distractions.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Parked thoughts</div>
              {session.distractions.map((d, i) => <div key={i} className="muted" style={{ fontSize: 13, display: 'flex', gap: 7 }}><span>·</span>{d}</div>)}
            </div>
          )}
          {session.notes && (
            <div style={{ marginBottom: 10 }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Notes</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{session.notes}</p>
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            {!confirm
              ? <button onClick={() => setConfirm(true)} style={{ fontSize: 12, color: 'var(--ink-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Delete</button>
              : <span style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="muted">Delete?</span>
                  <button onClick={onDelete} style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Yes</button>
                  <button onClick={() => setConfirm(false)} style={{ fontSize: 12, color: 'var(--ink-faint)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                </span>
            }
          </div>
        </div>
      )}
    </div>
  )
}
