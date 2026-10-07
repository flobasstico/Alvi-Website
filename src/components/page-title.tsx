export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="hyphens-auto font-display text-4xl text-accent drop-shadow [overflow-wrap:anywhere] sm:text-5xl">{title}</h1>
      {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
    </div>
  )
}
