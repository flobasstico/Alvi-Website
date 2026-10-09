/** Der in der Lobby ausgewählte Modus – nur im Browser gemerkt (wie die zuletzt gewählte Map) */

import { DEFAULT_GAME, gameBySlug } from "./games"

const KEY = "lobby-modus"
const EVENT = "lobby-modus"

export function readMode(): string {
  try {
    const v = localStorage.getItem(KEY)
    if (gameBySlug(v)) return v!
  } catch {}
  return DEFAULT_GAME
}

export function saveMode(slug: string) {
  try {
    localStorage.setItem(KEY, slug)
  } catch {}
  window.dispatchEvent(new Event(EVENT))
}

export function onModeChange(cb: () => void) {
  const storage = (e: StorageEvent) => e.key === KEY && cb()
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", storage)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", storage)
  }
}
