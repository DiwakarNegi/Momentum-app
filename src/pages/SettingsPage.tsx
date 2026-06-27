import { useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { useSettings } from '../db/hooks'
import { exportAllData, importAllData, clearAllData, updateSetting } from '../db/operations'
import { usePalette, THEMES, DISPLAY_FONTS, type PaletteId } from '../lib/usePalette'

interface Props {
  palette:    ReturnType<typeof usePalette>
  onSignOut?: () => void
}

export function SettingsPage({ palette, onSignOut }: Props) {
  const settings = useSettings()
  const { palette: activePalette, setPalette, displayFont, setDisplayFont } = palette

  const [importing,   setImporting]   = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importOk,    setImportOk]    = useState(false)
  const [clearing,    setClearing]    = useState(false)
  const [clearDone,   setClearDone]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    await exportAllData()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    setImportOk(false)
    setImporting(true)
    try {
      const text = await file.text()
      await importAllData(text)
      setImportOk(true)
      setTimeout(() => setImportOk(false), 3000)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleClear() {
    if (!clearing) { setClearing(true); return }
    await clearAllData()
    setClearing(false)
    setClearDone(true)
    setTimeout(() => setClearDone(false), 3000)
  }

  return (
    <div className="page fade-up" style={{ maxWidth: 560 }}>
      <header style={{ marginBottom: 26 }}>
        <h1 className="h-greet" style={{ fontSize: 27 }}>Settings</h1>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 14.5 }}>Your data stays on this device.</p>
      </header>

      {/* ── Appearance ──────────────────────────────────────────── */}
      <section style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Theme</div>
        <div className="card card-pad">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => setPalette(t.id as PaletteId)}
                aria-pressed={activePalette === t.id}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '14px 10px', borderRadius: 16, cursor: 'pointer',
                  background: activePalette === t.id ? 'var(--surface-soft)' : 'transparent',
                  border: activePalette === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'all .15s',
                }}
              >
                {/* Swatch */}
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: t.bg,
                  border: '1.5px solid rgba(255,255,255,.08)',
                  position: 'relative', overflow: 'hidden',
                  flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', bottom: 6, right: 6,
                    width: 12, height: 12, borderRadius: '50%',
                    background: t.accent,
                  }} />
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink-muted)', textAlign: 'center', lineHeight: 1.3 }}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>

          {/* Display font */}
          <div className="eyebrow" style={{ marginBottom: 10 }}>Display font</div>
          <div className="seg">
            {DISPLAY_FONTS.map(f => (
              <button
                key={f}
                className={displayFont === f ? 'on' : ''}
                onClick={() => setDisplayFont(f)}
                style={{ fontFamily: `'${f}', system-ui, sans-serif` }}
              >
                {f === 'Bricolage Grotesque' ? 'Bricolage' : f}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Preferences ─────────────────────────────────────────── */}
      <section style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Preferences</div>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <ToggleRow
            label="Weekly insights"
            description="Show a gentle pattern observation on the dashboard once there's enough data."
            checked={settings?.showWeeklyInsights ?? true}
            onChange={v => updateSetting('showWeeklyInsights', v)}
          />
          <div style={{ height: 1, background: 'var(--border)' }} />
          <ToggleRow
            label="Reframe prompt on rejection"
            description="When a job card moves to Rejected, offer an optional one-line reframe."
            checked={settings?.showReframePrompt ?? true}
            onChange={v => updateSetting('showReframePrompt', v)}
          />
        </div>
      </section>

      {/* ── Your data ───────────────────────────────────────────── */}
      <section style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Your data</div>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Export */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>Export to JSON</div>
              <div className="muted" style={{ fontSize: 12.5 }}>Download a full backup of everything.</div>
            </div>
            <button className="btn btn-accent btn-sm" style={{ flexShrink: 0 }} onClick={handleExport}>
              Export
            </button>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Import */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>Import from JSON</div>
              <div className="muted" style={{ fontSize: 12.5 }}>Replace all data with a backup file. Current data will be overwritten.</div>
              {importError && (
                <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: '#ef4444' }}>{importError}</div>
              )}
              {importOk && (
                <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: 'var(--c-sage)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="check" size={13} /> Data imported successfully.
                </div>
              )}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ flexShrink: 0 }}
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
            <input
              id="import-file"
              name="import-file"
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
              onChange={handleFileChange}
              aria-label="Choose backup JSON file"
            />
          </div>
        </div>
      </section>

      {/* ── Danger zone — red is allowed here (§2, §10) ─────────── */}
      <section style={{ marginBottom: 40 }}>
        <div className="eyebrow" style={{ marginBottom: 12, color: '#ef4444' }}>Danger zone</div>
        <div className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>Clear all data</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                Permanently deletes habits, logs, jobs, reflections, and momentum history.
              </div>
              {clearing && (
                <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, color: '#ef4444' }}>
                  Are you sure? This cannot be undone.
                </div>
              )}
              {clearDone && (
                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>All data cleared.</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {clearing && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setClearing(false)}
                >
                  Cancel
                </button>
              )}
              <button
                className="btn btn-sm"
                onClick={handleClear}
                style={{
                  background: clearing ? '#dc2626' : '#ef4444',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                }}
              >
                {clearing ? 'Yes, clear everything' : 'Clear all'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Account ──────────────────────────────────────────────────── */}
      {onSignOut && (
        <section style={{ marginBottom: 40 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Account</div>
          <div className="card card-pad">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>Sign out</div>
                <div className="muted" style={{ fontSize: 12.5 }}>Your data is saved to the cloud and will be here when you return.</div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={onSignOut}>
                Sign out
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({
  label, description, checked, onChange,
}: {
  label:       string
  description: string
  checked:     boolean
  onChange:    (v: boolean) => void
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <label htmlFor={id} style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
          {label}
        </label>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>{description}</p>
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`toggle-track ${checked ? 'on' : 'off'}`}
        style={{ flexShrink: 0, marginTop: 2 }}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  )
}
