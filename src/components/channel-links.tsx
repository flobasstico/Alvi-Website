"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import type { Channel, ChannelEntry } from "@/lib/site"
import { PlatformIcon } from "./channel-icons"

type Step = { channel: Channel; entry: ChannelEntry | null } | null

/**
 * Links zu Alvis Kanälen. Vor dem Verlassen der Seite kommt eine Rückfrage (Abbrechen möglich).
 * Hat eine Plattform mehrere Kanäle (z. B. YouTube), öffnet sich zuerst eine Auswahl.
 */
export function ChannelLinks({ channels }: { channels: Channel[] }) {
  const [step, setStep] = useState<Step>(null)
  const close = () => setStep(null)

  useEffect(() => {
    if (!step) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [step])

  const choose = (channel: Channel) =>
    setStep({
      channel,
      entry: channel.entries.length === 1 ? channel.entries[0] : null,
    })

  return (
    <>
      {channels.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => choose(c)}
          title={c.entries.length > 1 ? `${c.label} – ${c.entries.length} Kanäle` : c.label}
          aria-label={c.label}
          className="rounded-xl p-1 transition hover:-translate-y-0.5 hover:bg-white/10 active:scale-90"
        >
          <PlatformIcon platform={c.key} src={c.icon} className="h-8 w-8 sm:h-9 sm:w-9" />
        </button>
      ))}

      {/* Portal: Kacheln mit Blur-Effekt würden ein festes Overlay sonst abschneiden */}
      {step &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={close} role="presentation">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="channel-dialog-title"
              className="panel flex w-full max-w-sm flex-col gap-4 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <PlatformIcon platform={step.channel.key} src={step.channel.icon} className="h-8 w-8 shrink-0" />
                <h2 id="channel-dialog-title" className="font-display text-2xl">
                  {step.entry ? "Seite verlassen?" : `Alvi auf ${step.channel.label}`}
                </h2>
              </div>

              {step.entry ? (
                <>
                  <p className="text-sm text-muted">
                    Du wirst zu <b className="text-white">{step.channel.label}</b>
                    {step.entry.name !== step.channel.label && <> („{step.entry.name}“)</>} weitergeleitet. Der Link öffnet sich in einem
                    neuen Tab:
                    <span className="mt-1 block break-all font-mono text-xs">{step.entry.url}</span>
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => (step.channel.entries.length > 1 ? setStep({ channel: step.channel, entry: null }) : close())}
                    >
                      {step.channel.entries.length > 1 ? "Zurück" : "Abbrechen"}
                    </button>
                    <a href={step.entry.url} target="_blank" rel="noopener noreferrer" className="btn-primary" onClick={close} autoFocus>
                      Weiter zu {step.channel.label}
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted">Welchen Kanal möchtest du öffnen?</p>
                  <ul className="flex flex-col gap-2">
                    {step.channel.entries.map((e) => (
                      <li key={e.url}>
                        <button
                          type="button"
                          onClick={() => setStep({ channel: step.channel, entry: e })}
                          className="flex w-full items-center gap-3 rounded-xl border border-line bg-bg/50 px-3 py-2 text-left transition hover:border-accent active:scale-[.98]"
                        >
                          <PlatformIcon platform={step.channel.key} src={step.channel.icon} className="h-6 w-6 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold">{e.name}</span>
                            <span className="block truncate text-xs text-muted">{e.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                          </span>
                          <span className="text-muted">›</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-end">
                    <button type="button" className="btn-secondary" onClick={close}>
                      Abbrechen
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
