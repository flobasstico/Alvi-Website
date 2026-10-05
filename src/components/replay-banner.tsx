import Link from "next/link"

/** Kopf für „Nachspielen“-Ansichten von Glücksrad und Drop-Spot (nichts wird gespeichert) */
export function ReplayBanner({ title, status, back, children }: { title: string; status: string; back: string; children: React.ReactNode }) {
  return (
    <section className="panel mb-6 flex flex-col gap-3 border-accent-2/60">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip border-accent-2 text-accent-2">🔁 Nachspielen</span>
        <h2 className="font-display text-2xl">{title}</h2>
        <span className="chip ml-auto">Alvi: {status}</span>
      </div>
      {children}
      <p className="text-xs text-muted">
        Genau diese Challenge hat Alvi gespielt – jetzt bist du dran. Nachgespielte Challenges werden nicht gespeichert.{" "}
        <Link href={back} className="text-accent-2 underline">Selbst neu würfeln</Link>
      </p>
    </section>
  )
}
