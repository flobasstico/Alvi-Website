/** Einfacher Text mit Überschriften („## …“) und Absätzen, wie im Admin eingegeben */
export function LegalText({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/)
  return (
    <div className="panel flex max-w-3xl flex-col gap-4">
      {blocks.map((b, i) => {
        const lines = b.split("\n")
        const heading = lines[0].startsWith("## ") ? lines[0].slice(3) : null
        const body = (heading ? lines.slice(1) : lines).join("\n").trim()
        return (
          <section key={i}>
            {heading && <h2 className="mb-1 font-display text-xl">{heading}</h2>}
            {body && <p className="whitespace-pre-line text-sm leading-relaxed">{body}</p>}
          </section>
        )
      })}
    </div>
  )
}
