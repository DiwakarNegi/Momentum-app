import { useState } from 'react'
import { Icon } from './Icon'
import type { JobApplication } from '../db/types'
import { addJobApplication, updateJobApplication, deleteJobApplication } from '../db/operations'
import { STAGE_META } from '../lib/stages'

interface Props {
  app:     JobApplication | null  // null = new
  onClose: () => void
}

interface FormState {
  company:  string
  role:     string
  link:     string
  notes:    string
  fitScore: number | undefined
}

function init(app: JobApplication | null): FormState {
  return app
    ? { company: app.company, role: app.role, link: app.link ?? '', notes: app.notes ?? '', fitScore: app.fitScore }
    : { company: '', role: '', link: '', notes: '', fitScore: undefined }
}

export function JobModal({ app, onClose }: Props) {
  const [form,    setForm]    = useState<FormState>(() => init(app))
  const [saving,  setSaving]  = useState(false)
  const [confirm, setConfirm] = useState(false)

  const isNew = app === null
  const set   = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.company.trim() || !form.role.trim()) return
    setSaving(true)
    try {
      const payload = {
        company:  form.company.trim(),
        role:     form.role.trim(),
        link:     form.link.trim() || undefined,
        notes:    form.notes.trim() || undefined,
        fitScore: form.fitScore,
      }
      if (isNew) {
        await addJobApplication({ ...payload, stage: 'saved' })
      } else {
        await updateJobApplication(app.id, payload)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!app) return
    await deleteJobApplication(app.id)
    onClose()
  }

  const stageMeta = app ? STAGE_META[app.stage] : null

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>
              {isNew ? 'Save a role' : 'Edit application'}
            </h2>
            {stageMeta && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                <span
                  className="eyebrow"
                  style={{ color: `var(--c-${stageMeta.color})`, letterSpacing: 0 }}
                >
                  <Icon name={stageMeta.icon} size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                  {stageMeta.label}
                </span>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={17} />
          </button>
        </div>

        {/* Company */}
        <div className="eyebrow" style={{ marginBottom: 7 }}>Company *</div>
        <input
          id="job-company"
          name="company"
          type="text"
          className="field"
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: 14 }}
          value={form.company}
          onChange={e => set('company', e.target.value)}
          placeholder="e.g. Acme Corp"
          autoFocus={isNew}
          maxLength={80}
        />

        {/* Role */}
        <div className="eyebrow" style={{ marginBottom: 7 }}>Role *</div>
        <input
          id="job-role"
          name="role"
          type="text"
          className="field"
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: 14 }}
          value={form.role}
          onChange={e => set('role', e.target.value)}
          placeholder="e.g. Frontend Engineer"
          maxLength={80}
        />

        {/* Link */}
        <div className="eyebrow" style={{ marginBottom: 7 }}>Job link <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
        <input
          id="job-link"
          name="link"
          type="url"
          className="field"
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: 14 }}
          value={form.link}
          onChange={e => set('link', e.target.value)}
          placeholder="Posting URL"
        />

        {/* Fit score */}
        <div className="eyebrow" style={{ marginBottom: 9 }}>Fit <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => set('fitScore', form.fitScore === n ? undefined : n)}
              style={{
                width: 38, height: 38, borderRadius: 12, fontSize: 14, fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all .15s',
                background: (form.fitScore ?? 0) >= n ? 'var(--accent)' : 'var(--surface-soft)',
                color:      (form.fitScore ?? 0) >= n ? '#fff' : 'var(--ink-muted)',
              }}
              aria-pressed={(form.fitScore ?? 0) >= n}
            >
              {n}
            </button>
          ))}
          {form.fitScore != null && (
            <button
              onClick={() => set('fitScore', undefined)}
              className="icon-btn"
              aria-label="Clear fit score"
              style={{ marginLeft: 2 }}
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        {/* Notes */}
        <div className="eyebrow" style={{ marginBottom: 7 }}>Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
        <textarea
          id="job-notes"
          name="notes"
          className="field"
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 72, resize: 'vertical', marginBottom: 20 }}
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Context, contacts, or reminders…"
          maxLength={500}
        />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            className="btn btn-accent"
            style={{ flex: 1 }}
            onClick={handleSave}
            disabled={!form.company.trim() || !form.role.trim() || saving}
          >
            {saving ? 'Saving…' : isNew ? 'Add to funnel' : 'Save changes'}
          </button>
        </div>

        {/* Delete — red allowed for genuinely destructive action (§2, §10) */}
        {!isNew && !confirm && (
          <button
            onClick={() => setConfirm(true)}
            style={{ marginTop: 12, width: '100%', textAlign: 'center', fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
          >
            Delete application
          </button>
        )}
        {!isNew && confirm && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <span className="muted" style={{ fontSize: 12 }}>Delete permanently?</span>
            <button
              onClick={handleDelete}
              style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Yes, delete
            </button>
            <button
              onClick={() => setConfirm(false)}
              style={{ fontSize: 12, color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
