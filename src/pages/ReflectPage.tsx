import { useState, useEffect, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { useTodayReflection, useReflections } from '../db/hooks'
import { upsertReflection } from '../db/operations'
import {
  getPromptForDate,
  energyColor,
  energyLabel,
  PROMPT_LABEL,
  PROMPT_ICON,
  PROMPT_COLOR,
} from '../lib/prompts'
import { Icon } from '../components/Icon'
import type { Reflection } from '../db/types'

export function ReflectPage() {
  const todayStr    = format(new Date(), 'yyyy-MM-dd')
  const todayPrompt = useMemo(() => getPromptForDate(new Date()), [])

  const existing    = useTodayReflection()
  const reflections = useReflections(30)

  const [energy,   setEnergy]   = useState(5)
  const [response, setResponse] = useState('')
  const [saved,    setSaved]    = useState(false)

  useEffect(() => {
    if (existing) {
      setEnergy(existing.energy)
      setResponse(existing.response ?? '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id])

  async function handleSave() {
    await upsertReflection({
      date:       todayStr,
      energy,
      promptType: todayPrompt.type,
      promptText: todayPrompt.text,
      response:   response.trim() || undefined,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const chartData = useMemo(() => {
    if (!reflections) return []
    return [...reflections]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map(r => ({ label: format(parseISO(r.date), 'M/d'), energy: r.energy }))
  }, [reflections])

  const isDone = !!existing
  const eColor = energyColor(energy)

  return (
    <div className="page fade-up">
      <header style={{ marginBottom: 26 }}>
        <h1 className="h-greet" style={{ fontSize: 27 }}>Reflect</h1>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 14.5 }}>30 seconds · always skippable</p>
      </header>

      {/* ── Check-in card ─────────────────────────────────────────────────── */}
      <div className="card card-pad" style={{ marginBottom: 18 }}>

        {isDone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--c-sage)', display: 'inline-flex' }}>
              <Icon name="check" size={15} />
            </span>
            <span className="muted" style={{ fontSize: 13 }}>Today's check-in saved</span>
          </div>
        )}

        {/* Energy slider */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <label className="eyebrow" htmlFor="energy-slider" style={{ letterSpacing: 0, textTransform: 'none', fontSize: 14, fontWeight: 600 }}>
              How's your energy?
            </label>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span
                className="num"
                style={{ fontSize: 34, lineHeight: 1, color: eColor, transition: 'color .2s' }}
              >
                {energy}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>{energyLabel(energy)}</span>
            </div>
          </div>

          <input
            id="energy-slider"
            type="range"
            min={1} max={10}
            value={energy}
            onChange={e => setEnergy(+e.target.value)}
            className="mi-range"
            style={{ color: eColor, width: '100%' }}
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={energy}
            aria-valuetext={`${energy} — ${energyLabel(energy)}`}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-faint)', marginTop: 8, userSelect: 'none' }}>
            <span>1 · drained</span>
            <span>5 · okay</span>
            <span>10 · charged</span>
          </div>
        </div>

        {/* Rotating prompt */}
        <div style={{ marginBottom: 18 }}>
          {/* Prompt type chip */}
          <div style={{ marginBottom: 12 }}>
            <span
              className="chip done static"
              style={{ background: `var(--c-${PROMPT_COLOR[todayPrompt.type]})`, fontSize: 11.5 }}
            >
              <Icon name={PROMPT_ICON[todayPrompt.type]} size={13} />
              {PROMPT_LABEL[todayPrompt.type]}
            </span>
          </div>

          <p style={{ fontSize: 14.5, fontWeight: 500, marginBottom: 12, lineHeight: 1.5 }}>
            {todayPrompt.text}
          </p>

          <textarea
            className="field"
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 76, resize: 'vertical' }}
            value={response}
            onChange={e => setResponse(e.target.value)}
            placeholder="Optional — a few words, or skip entirely…"
            rows={2}
            maxLength={500}
          />
        </div>

        {/* Save button */}
        {saved ? (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 0', borderRadius: 50, fontSize: 14, fontWeight: 600,
              color: 'var(--c-sage)',
            }}
          >
            <Icon name="check" size={17} /> Saved!
          </div>
        ) : (
          <button
            className="btn btn-accent"
            style={{ width: '100%' }}
            onClick={handleSave}
          >
            {isDone ? 'Update check-in' : 'Save check-in'}
          </button>
        )}
      </div>

      {/* ── Energy sparkline ──────────────────────────────────────────────── */}
      {chartData.length >= 2 && (
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Energy — last 14 days</div>
          <EnergySpark data={chartData} />
        </div>
      )}

      {/* ── Past reflections ──────────────────────────────────────────────── */}
      {reflections && reflections.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Past check-ins</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reflections
              .filter(r => r.date !== todayStr)
              .map(r => (
                <PastReflection key={r.id} r={r} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Custom SVG sparkline ──────────────────────────────────────────────────────

interface SparkDatum { label: string; energy: number }

function EnergySpark({ data }: { data: SparkDatum[] }) {
  const W    = 320
  const H    = 80
  const padL = 4
  const padR = 4
  const padT = 6
  const padB = 22
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const n      = data.length

  const xOf = (i: number) => padL + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW)
  const yOf = (v: number) => padT + chartH - ((v - 1) / 9) * chartH
  const step = Math.max(1, Math.round(n / 5))

  // Build area polygon
  const areaPoints = [
    `${xOf(0)},${H - padB}`,
    ...data.map((d, i) => `${xOf(i)},${yOf(d.energy)}`),
    `${xOf(n - 1)},${H - padB}`,
  ].join(' ')

  const linePts = data.map((d, i) => `${xOf(i)},${yOf(d.energy)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }} aria-label="Energy sparkline" role="img">
      <defs>
        <linearGradient id="energy-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {[1, 5, 10].map(v => (
        <line key={v} x1={padL} y1={yOf(v)} x2={W - padR} y2={yOf(v)}
          stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
      ))}

      <polygon points={areaPoints} fill="url(#energy-fill)" />

      <polyline
        points={linePts}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {data.map((d, i) => (
        <circle
          key={i}
          cx={xOf(i)}
          cy={yOf(d.energy)}
          r="3.5"
          fill={energyColor(d.energy)}
          stroke="var(--surface)"
          strokeWidth="1.5"
        />
      ))}

      {data.map((d, i) =>
        i % step === 0 ? (
          <text key={i} x={xOf(i)} y={H - 5} textAnchor="middle" fontSize="9" fill="var(--ink-faint)">
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  )
}

// ── Past reflection row ───────────────────────────────────────────────────────

function PastReflection({ r }: { r: Reflection }) {
  const [open, setOpen] = useState(false)

  const dateLabel = (() => {
    const diff = Math.round(
      (new Date().setHours(0, 0, 0, 0) - new Date(r.date).setHours(0, 0, 0, 0)) / 86_400_000,
    )
    if (diff === 1) return 'Yesterday'
    if (diff < 7)   return `${diff} days ago`
    return format(parseISO(r.date), 'MMM d')
  })()

  return (
    <div
      className="card"
      style={{ borderRadius: 16, overflow: 'hidden', cursor: 'pointer' }}
      onClick={() => setOpen(o => !o)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <div
          style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: energyColor(r.energy),
            color: '#fff', fontSize: 13.5, fontWeight: 700,
          }}
          aria-label={`Energy ${r.energy}`}
        >
          {r.energy}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{dateLabel}</span>
            <span className="faint" style={{ fontSize: 11 }}>{PROMPT_LABEL[r.promptType]}</span>
          </div>
          {!open && r.response && (
            <p className="muted" style={{ fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.response}
            </p>
          )}
        </div>

        <span
          className="faint"
          style={{
            display: 'inline-flex', flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s',
          }}
        >
          <Icon name="chevronDown" size={14} />
        </span>
      </div>

      {open && (
        <div style={{ padding: '4px 16px 14px', borderTop: '1px solid var(--border)' }}>
          <p className="faint" style={{ fontSize: 11, fontStyle: 'italic', marginBottom: 6 }}>{r.promptText}</p>
          {r.response
            ? <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>{r.response}</p>
            : <p className="faint" style={{ fontSize: 12 }}>No response written</p>
          }
        </div>
      )}
    </div>
  )
}
