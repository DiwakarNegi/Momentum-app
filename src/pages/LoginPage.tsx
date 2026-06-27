import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [mode,     setMode]     = useState<'signin' | 'signup'>('signin')
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [check,    setCheck]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name.trim() } },
      })
      if (error) setError(error.message)
      else setCheck(true)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo / wordmark */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24, margin: '0 auto 20px',
            background: 'var(--accent)',
            boxShadow: '0 0 56px -8px var(--accent), 0 2px 0 0 rgba(255,255,255,0.12) inset',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', position: 'relative',
          }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" style={{ position: 'relative', zIndex: 1 }}>
              <path
                d="M2 17 C5 17 6 10 9 10 C12 10 13 15 16 13 C19 11 20 7 22 6 L22 24 L2 24 Z"
                fill="rgba(0,0,0,0.18)"
              />
              <path
                d="M2 17 C5 17 6 10 9 10 C12 10 13 15 16 13 C19 11 20 7 22 6"
                stroke="rgba(0,0,0,0.75)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              />
              <circle cx="22" cy="6" r="2.4" fill="rgba(0,0,0,0.75)" />
            </svg>
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.8px' }}>Momentum</h1>
          <p className="muted" style={{ fontSize: 14 }}>
            {mode === 'signin' ? 'Welcome back.' : 'Create your account.'}
          </p>
        </div>

        {check ? (
          <div className="card card-pad" style={{ textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Check your email</h2>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
              We sent a confirmation link to <strong>{email}</strong>.<br />
              Click it to activate your account, then come back and sign in.
            </p>
            <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={() => { setCheck(false); setMode('signin') }}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="eyebrow" style={{ display: 'block', marginBottom: 7 }}>Your name</label>
                <input
                  id="auth-name"
                  name="name"
                  className="field"
                  type="text"
                  placeholder="What should we call you?"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required={mode === 'signup'}
                  autoFocus
                  maxLength={40}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            )}
            <div>
              <label htmlFor="auth-email" className="eyebrow" style={{ display: 'block', marginBottom: 7 }}>Email</label>
              <input
                id="auth-email"
                name="email"
                className="field"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="eyebrow" style={{ display: 'block', marginBottom: 7 }}>Password</label>
              <input
                id="auth-password"
                name="password"
                className="field"
                type="password"
                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>
            )}

            <button
              className="btn btn-accent"
              type="submit"
              disabled={loading}
              style={{ width: '100%', marginTop: 4 }}
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            <p className="muted" style={{ textAlign: 'center', fontSize: 13, margin: 0 }}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
