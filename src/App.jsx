import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const MODES = {
  focus: { label: 'Focus', minutes: 25, color: 'var(--focus)' },
  break: { label: 'Short Break', minutes: 5, color: 'var(--break)' },
  long:  { label: 'Long Break', minutes: 15, color: 'var(--long)' },
}
const CYCLE = ['focus', 'break', 'focus', 'break', 'focus', 'long']
const KEY = 'focuspad-state-v1'

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (s && typeof s.completedFocus === 'number') return s
  } catch { /* ignore */ }
  return { completedFocus: 0, history: [], settings: { focus: 25, break: 5, long: 15 } }
}

function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function App() {
  const persisted = useRef(loadState())
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [remaining, setRemaining] = useState(MODES.focus.minutes * 60)
  const [running, setRunning] = useState(false)
  const [justDone, setJustDone] = useState(false)
  const [settings, setSettings] = useState(persisted.current.settings)
  const [showSettings, setShowSettings] = useState(false)
  const [, forceTick] = useState(0)

  const phase = CYCLE[phaseIdx % CYCLE.length]
  const mode = MODES[phase]
  const totalSec = settings[phase] * 60

  // persist completed stats
  const persist = useCallback((patch) => {
    const next = { ...persisted.current, ...patch }
    persisted.current = next
    localStorage.setItem(KEY, JSON.stringify(next))
  }, [])

  // timer: track wall-clock to stay accurate across tab throttling
  const deadlineRef = useRef(null)
  useEffect(() => {
    if (!running) return
    deadlineRef.current = Date.now() + remaining * 1000
    const iv = setInterval(() => {
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        clearInterval(iv)
        setRunning(false)
        setJustDone(true)
        setTimeout(() => setJustDone(false), 1800)
        // notify + advance
        try { new AudioContext() } catch { /* autoplay blocked, fine */ }
        document.title = '✓ Done — FocusPad'
        if (phase === 'focus') {
          const rec = { type: 'focus', minutes: settings.focus, when: Date.now() }
          persist({
            completedFocus: persisted.current.completedFocus + 1,
            history: [rec, ...persisted.current.history].slice(0, 100),
          })
        }
        setPhaseIdx(i => i + 1)
        const nextPhase = CYCLE[(phaseIdx + 1) % CYCLE.length]
        setRemaining(settings[nextPhase] * 60)
        setTimeout(() => { document.title = 'FocusPad — Pomodoro Timer' }, 3000)
      } else {
        document.title = `${fmt(left)} · ${MODES[phase].label} — FocusPad`
      }
    }, 250)
    return () => clearInterval(iv)
  }, [running])

  // reset remaining when phase or settings change while paused
  useEffect(() => {
    if (!running) setRemaining(settings[phase] * 60)
  }, [phaseIdx, settings])

  const progress = useMemo(() => 1 - remaining / totalSec, [remaining, totalSec])
  const R = 120, CIRC = 2 * Math.PI * R

  const todayFocus = useMemo(() => {
    const startOfDay = new Date().setHours(0, 0, 0, 0)
    return persisted.current.history.filter(h => h.when >= startOfDay)
  }, [forceTick, running, justDone])

  const todayMinutes = todayFocus.reduce((s, h) => s + h.minutes, 0)

  const setSetting = (key, val) => {
    const v = Math.max(1, Math.min(90, Number(val) || 1))
    setSettings(s => ({ ...s, [key]: v }))
    persist({ settings: { ...settings, [key]: v } })
  }

  const dotCount = 6
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">Focus<span style={{ color: mode.color }}>Pad</span></h1>
        <button className="text-xs" style={{ color: 'var(--muted)' }} onClick={() => setShowSettings(s => !s)}>
          {showSettings ? 'close' : 'settings'}
        </button>
      </header>

      {/* phase dots */}
      <div className="mb-4 flex justify-center gap-1.5">
        {Array.from({ length: dotCount }, (_, i) => (
          <span key={i} className="h-1.5 w-6 rounded-full transition-colors"
            style={{
              background: i === phaseIdx % dotCount ? mode.color
                : i < phaseIdx % dotCount ? 'var(--muted)' : 'var(--surface)',
              border: '1px solid var(--border)',
            }} />
        ))}
      </div>

      <div className={`relative flex flex-col items-center ${running ? 'running' : ''} ${justDone ? 'done-pulse' : ''}`}>
        <svg viewBox="0 0 280 280" className="progress-ring h-72 w-72" role="img" aria-label={`${mode.label} timer, ${fmt(remaining)} remaining`}>
          <circle cx="140" cy="140" r={R} fill="none" stroke="var(--surface)" strokeWidth="14" />
          <circle cx="140" cy="140" r={R} fill="none" stroke={mode.color} strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
            transform="rotate(-90 140 140)"
            style={{ transition: 'stroke-dashoffset 300ms linear, stroke 400ms' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs uppercase tracking-[0.3em]" style={{ color: mode.color }}>{mode.label}</span>
          <span className="mono mt-1 text-5xl font-bold">{fmt(remaining)}</span>
          <span className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            {phaseIdx % CYCLE.length === 0 ? 'next up: short break' : phase === 'break' ? 'next up: focus' : 'next up: long break'}
          </span>
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <button onClick={() => setRunning(r => !r)}
          className="rounded-xl px-8 py-3 text-sm font-semibold transition-transform active:scale-95"
          style={{ background: mode.color, color: '#0e131a' }}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button onClick={() => { setRunning(false); setRemaining(settings[phase] * 60) }}
          className="rounded-xl px-5 py-3 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
          Reset
        </button>
        <button onClick={() => { setRunning(false); setPhaseIdx(i => i + 1); setRemaining(settings[CYCLE[(phaseIdx + 1) % CYCLE.length]] * 60) }}
          className="rounded-xl px-5 py-3 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
          Skip
        </button>
      </div>

      {showSettings && (
        <div className="mt-6 rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="mb-3 text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>minutes per phase</p>
          <div className="grid grid-cols-3 gap-3">
            {['focus', 'break', 'long'].map(k => (
              <label key={k} className="text-center">
                <span className="mb-1 block text-xs" style={{ color: MODES[k].color }}>{MODES[k].label}</span>
                <input type="number" min="1" max="90" value={settings[k]}
                  onChange={e => setSetting(k, e.target.value)}
                  className="mono w-full rounded-lg border bg-transparent p-2 text-center text-sm outline-none"
                  style={{ borderColor: 'var(--border)' }} />
              </label>
            ))}
          </div>
        </div>
      )}

      <footer className="mt-8 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="mono text-2xl font-bold" style={{ color: 'var(--focus)' }}>{todayFocus.length}</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>sessions today</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="mono text-2xl font-bold" style={{ color: 'var(--break)' }}>{todayMinutes}</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>minutes today</p>
        </div>
      </footer>
      <p className="mt-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
        total focus sessions all-time: {persisted.current.completedFocus}
      </p>
    </div>
  )
}
