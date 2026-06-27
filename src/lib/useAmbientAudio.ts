import { useRef, useState, useCallback, useEffect } from 'react'

// ─── Sounds ───────────────────────────────────────────────────────────────────

export type SoundId = 'white' | 'pink' | 'brown' | 'rain'

export const SOUNDS: Record<SoundId, { label: string; emoji: string }> = {
  white: { label: 'White',  emoji: '🌊' },
  pink:  { label: 'Pink',   emoji: '🌸' },
  brown: { label: 'Brown',  emoji: '🍂' },
  rain:  { label: 'Rain',   emoji: '🌧️' },
}

// ─── Noise generators ─────────────────────────────────────────────────────────

function fillWhiteNoise(data: Float32Array) {
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
}

function fillPinkNoise(data: Float32Array) {
  // Paul Kellet's pink noise approximation (softer, warmer feel)
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886*b0 + w*0.0555179
    b1 = 0.99332*b1 + w*0.0750759
    b2 = 0.96900*b2 + w*0.1538520
    b3 = 0.86650*b3 + w*0.3104856
    b4 = 0.55000*b4 + w*0.5329522
    b5 = -0.7616*b5 - w*0.0168980
    data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.11
    b6 = w * 0.115926
  }
}

function fillBrownNoise(data: Float32Array) {
  // Integrate white noise for a deep, rolling rumble
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1
    last = (last + 0.02 * w) / 1.02
    data[i] = last * 3.5
  }
}

function fillRainNoise(data: Float32Array) {
  // Brown-ish base + sparse high-frequency droplet crackle
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1
    last = (last + 0.04 * w) / 1.04
    const droplet = Math.random() < 0.0008 ? (Math.random() * 0.4 - 0.2) : 0
    data[i] = Math.max(-1, Math.min(1, last * 2.5 + droplet))
  }
}

function buildBuffer(ctx: AudioContext, sound: SoundId): AudioBuffer {
  const frames = ctx.sampleRate * 6  // 6s loop avoids obvious repetition
  const buf    = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data   = buf.getChannelData(0)
  if      (sound === 'white') fillWhiteNoise(data)
  else if (sound === 'pink')  fillPinkNoise(data)
  else if (sound === 'brown') fillBrownNoise(data)
  else                         fillRainNoise(data)
  return buf
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAmbientAudio() {
  const ctxRef    = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const gainRef   = useRef<GainNode | null>(null)
  const filterRef = useRef<BiquadFilterNode | null>(null)

  const [currentSound, setCurrentSound] = useState<SoundId | null>(null)
  const [volume,       setVolumeState]  = useState(0.35)

  function ctx() {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    return ctxRef.current
  }

  function stopCurrent() {
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    if (filterRef.current) {
      filterRef.current.disconnect()
      filterRef.current = null
    }
  }

  const play = useCallback((sound: SoundId, vol?: number) => {
    const c  = ctx()
    const v  = vol ?? volume
    stopCurrent()

    if (!gainRef.current) {
      gainRef.current = c.createGain()
      gainRef.current.connect(c.destination)
    }
    gainRef.current.gain.setValueAtTime(v, c.currentTime)

    // Rain gets an additional low-pass filter for a softer, wetter character
    let dest: AudioNode = gainRef.current
    if (sound === 'rain') {
      const f = c.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 1600
      f.connect(gainRef.current)
      filterRef.current = f
      dest = f
    }

    const buf    = buildBuffer(c, sound)
    const source = c.createBufferSource()
    source.buffer = buf
    source.loop   = true
    source.connect(dest)
    source.start()
    sourceRef.current = source

    if (c.state === 'suspended') c.resume()
    setCurrentSound(sound)
  }, [volume])

  const stop = useCallback(() => {
    stopCurrent()
    setCurrentSound(null)
  }, [])

  const setVolume = useCallback((v: number) => {
    setVolumeState(v)
    if (gainRef.current && ctxRef.current) {
      gainRef.current.gain.setValueAtTime(v, ctxRef.current.currentTime)
    }
  }, [])

  // Smooth volume fade — used to dim audio during breaks and restore it after
  const fade = useCallback((targetVol: number, durationMs: number) => {
    if (!gainRef.current || !ctxRef.current) return
    const c      = ctxRef.current
    const g      = gainRef.current
    const now    = c.currentTime
    const clamped = Math.max(0.001, targetVol)  // exponentialRamp can't go to 0
    g.gain.cancelScheduledValues(now)
    g.gain.setValueAtTime(Math.max(0.001, g.gain.value), now)
    g.gain.exponentialRampToValueAtTime(clamped, now + durationMs / 1000)
  }, [])

  useEffect(() => () => {
    stopCurrent()
    if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null }
  }, [])

  return { currentSound, volume, play, stop, setVolume, fade }
}
