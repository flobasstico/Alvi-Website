import clsx from "clsx"

const TYPE_EMOJI: Record<string, string> = { waffe: "🔫", heilung: "🧪", utility: "🧰" }

export function ItemIcon({ url, type, name, className }: { url?: string | null; type: string; name: string; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} crossOrigin="anonymous" className={clsx("object-contain drop-shadow-lg", className)} draggable={false} />
  }
  return (
    <span className={clsx("flex items-center justify-center drop-shadow-lg", className)} aria-label={name}>
      {TYPE_EMOJI[type] ?? "❔"}
    </span>
  )
}
