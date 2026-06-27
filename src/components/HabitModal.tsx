import { useState } from 'react'
import { Icon } from './Icon'
import type { Habit } from '../db/types'
import { HABIT_COLORS, HABIT_ICON_NAMES } from '../lib/stages'
import { addHabit, updateHabit, archiveHabit } from '../db/operations'

interface Props {
  habit:   Habit | null  // null = new habit
  onClose: () => void
}

type Cadence = Habit['cadence']

interface FormState {
  icon:          string
  name:          string
  color:         string
  cadence:       Cadence
  targetPerWeek: number
}

function initialState(habit: Habit | null): FormState {
  if (habit) {
    return {
      icon:          habit.icon ?? 'spark',
      name:          habit.name,
      color:         habit.color ?? 'sage',
      cadence:       habit.cadence,
      targetPerWeek: habit.targetPerWeek ?? 4,
    }
  }
  return { icon: 'spark', name: '', color: 'sage', cadence: 'daily', targetPerWeek: 4 }
}

export function HabitModal({ habit, onClose }: Props) {
  const [form,   setForm]   = useState<FormState>(() => initialState(habit))
  const [saving, setSaving] = useState(false)

  const isNew = habit === null
  const set   = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        name:          form.name.trim(),
        icon:          form.icon,
        color:         form.color,
        cadence:       form.cadence,
        targetPerWeek: form.cadence !== 'daily' ? form.targetPerWeek : undefined,
      }
      if (isNew) {
        await addHabit(payload)
      } else {
        await updateHabit(habit.id, payload)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    if (!habit) return
    await archiveHabit(habit.id)
    onClose()
  }

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 19 }}>{isNew ? 'New habit' : 'Edit habit'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={17} />
          </button>
        </div>

        {/* Preview + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div
            className="tile"
            style={{ width: 54, height: 54, '--tile-c': `var(--c-${form.color})` } as React.CSSProperties}
          >
            <Icon name={form.icon} size={28} />
          </div>
          <input
            id="habit-name"
            name="habit-name"
            className="field"
            style={{ flex: 1 }}
            placeholder="Habit name"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            autoFocus
            maxLength={60}
          />
        </div>

        {/* Icon picker */}
        <div className="eyebrow" style={{ marginBottom: 9 }}>Icon</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 18 }}>
          {HABIT_ICON_NAMES.map(n => (
            <button
              key={n}
              onClick={() => set('icon', n)}
              className="icon-btn"
              style={{
                width: '100%', aspectRatio: '1', height: 'auto',
                color:       form.icon === n ? `var(--c-${form.color})` : 'var(--ink-muted)',
                borderColor: form.icon === n ? `var(--c-${form.color})` : 'var(--border)',
                background:  form.icon === n ? `color-mix(in srgb, var(--c-${form.color}) 14%, var(--surface))` : 'var(--surface-soft)',
              }}
              aria-pressed={form.icon === n}
              aria-label={n}
            >
              <Icon name={n} size={20} />
            </button>
          ))}
        </div>

        {/* Color picker */}
        <div className="eyebrow" style={{ marginBottom: 9 }}>Color</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {HABIT_COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => set('color', c.id)}
              aria-label={c.label}
              aria-pressed={form.color === c.id}
              style={{
                width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
                background: `var(--c-${c.id})`,
                border:     form.color === c.id ? '3px solid var(--ink)' : '3px solid transparent',
                boxShadow:  form.color === c.id ? `0 0 14px -2px var(--c-${c.id})` : 'none',
              }}
            />
          ))}
        </div>

        {/* Cadence */}
        <div className="eyebrow" style={{ marginBottom: 9 }}>Cadence</div>
        <div className="seg" style={{ marginBottom: form.cadence === 'daily' ? 22 : 14 }}>
          {(['daily', 'flexible'] as Cadence[]).map(c => (
            <button
              key={c}
              className={form.cadence === c ? 'on' : ''}
              onClick={() => set('cadence', c)}
            >
              {c === 'daily' ? 'Every day' : 'A few times a week'}
            </button>
          ))}
        </div>

        {form.cadence !== 'daily' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <span className="muted" style={{ fontSize: 13.5 }}>Target</span>
            <div style={{ flex: 1 }}>
              <input
                id="habit-target"
                name="target-per-week"
                type="range"
                className="mi-range"
                min={1} max={7}
                value={form.targetPerWeek}
                onChange={e => set('targetPerWeek', +e.target.value)}
                style={{ color: `var(--c-${form.color})` }}
              />
            </div>
            <span className="num" style={{ fontWeight: 700, width: 70, textAlign: 'right' }}>
              {form.targetPerWeek}× / week
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          {!isNew && (
            <button className="btn btn-ghost" onClick={handleArchive} style={{ color: 'var(--ink-muted)' }}>
              Archive
            </button>
          )}
          <button
            className="btn btn-accent"
            style={{ flex: 1 }}
            disabled={!form.name.trim() || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : isNew ? 'Add to garden' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
