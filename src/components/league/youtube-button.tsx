"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { PlatformIcon } from "@/components/channel-icons"

/** ▶-Button zum Video einer Liga-Challenge; vor dem Verlassen der Seite kommt eine Rückfrage */
export function YoutubeButton({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-[#ff0033]/15 px-2.5 py-1 text-sm font-bold text-white transition hover:bg-[#ff0033]/30"
        title="Video auf YouTube ansehen"
      >
        <PlatformIcon platform="link_youtube" className="h-5 w-5" /> Video
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)} role="presentation">
            <div role="dialog" aria-modal="true" className="panel flex w-full max-w-sm flex-col gap-4" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-display text-2xl">Seite verlassen?</h2>
              <p className="text-sm text-muted">
                Das Video zu <b className="text-white">„{title}“</b> öffnet sich auf YouTube in einem neuen Tab:
                <span className="mt-1 block break-all font-mono text-xs">{url}</span>
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                  Abbrechen
                </button>
                <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary" onClick={() => setOpen(false)} autoFocus>
                  Weiter zu YouTube
                </a>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
