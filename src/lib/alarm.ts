// Alarm-Sirene per Web Audio – keine Audiodatei nötig, funktioniert auch als OBS-Browserquelle.

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx ??= new Ctor()
  return ctx
}

/** Muss einmal nach einer Nutzeraktion laufen, damit normale Browser Ton erlauben. */
export async function unlockAudio(): Promise<boolean> {
  const c = audio()
  if (!c) return false
  if (c.state === "suspended") await c.resume().catch(() => {})
  return c.state === "running"
}

export function audioReady(): boolean {
  return audio()?.state === "running"
}

/** Zweiton-Sirene, ca. 1,8 Sekunden. */
export function playAlarm(volume = 0.35) {
  const c = audio()
  if (!c) return
  if (c.state === "suspended") void c.resume()
  const t0 = c.currentTime + 0.02
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.03)
  gain.gain.setValueAtTime(volume, t0 + 1.7)
  gain.gain.linearRampToValueAtTime(0, t0 + 1.85)
  gain.connect(c.destination)

  const osc = c.createOscillator()
  osc.type = "sawtooth"
  for (let i = 0; i < 6; i++) osc.frequency.setValueAtTime(i % 2 ? 660 : 880, t0 + i * 0.3)
  const filter = c.createBiquadFilter()
  filter.type = "lowpass"
  filter.frequency.value = 2400
  osc.connect(filter).connect(gain)
  osc.start(t0)
  osc.stop(t0 + 1.9)

  // Testhaken für automatisierte Prüfungen
  ;(window as unknown as { __alarmCount?: number }).__alarmCount =
    ((window as unknown as { __alarmCount?: number }).__alarmCount ?? 0) + 1
}
