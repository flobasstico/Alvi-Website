/** Seitentitel im Fortnite-Menü-Stil: groß, GROSS geschrieben, mit gelbem schrägem Balken */
export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="hyphens-auto font-display text-4xl leading-none text-white drop-shadow-[0_3px_0_#0008] [overflow-wrap:anywhere] sm:text-5xl">{title}</h1>
      <span className="mt-2 block h-1.5 w-24 -skew-x-[20deg] bg-accent" aria-hidden />
      {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
    </div>
  )
}
