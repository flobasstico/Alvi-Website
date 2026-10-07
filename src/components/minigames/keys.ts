/** Tasten nicht abfangen, wenn gerade in ein Feld getippt oder ein Link/Button per Tastatur bedient wird */
export function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return !!t?.closest?.("input, textarea, select, button, a, [contenteditable='true']")
}
