/* eslint-disable @next/next/no-img-element */
import clsx from "clsx"
import Link from "next/link"
import { leagueTable, type LeagueRow } from "@/lib/league"
import { loadLeague } from "@/lib/league-server"
import { createClient } from "@/lib/supabase/server"

type Member = { key: string; name: string; image: string | null; skin: boolean; color: string; plate: string; href: string; lead?: boolean }
type Viewer = { name: string; avatar: string | null; login: string | null } | null

/**
 * Lobby-Mitte wie bei Fortnite: Platz 1 der Creator-Liga steht vorne in der Mitte, daneben Alvi und die nächsten Plätze als Party.
 * Ganz rechts der eigene Platz: eingeloggt das eigene Profilbild, sonst ein freier „+“-Platz.
 */
export async function Party({ mainLogin, viewer }: { mainLogin: string; viewer: Viewer }) {
  const supabase = await createClient()
  const [league, { data: main }] = await Promise.all([
    loadLeague(supabase),
    supabase.from("profiles").select("id").ilike("twitch_login", mainLogin.replace(/[%_\\]/g, "\\$&")).maybeSingle(),
  ])
  const rows = leagueTable(league.challenges, league.results, league.creators)
  const byId = new Map(league.creators.map((c) => [c.id, c]))
  // Alvi = Creator mit verknüpftem Twitch-Hauptkanal, sonst der mit dem Namen „Alvi“
  const alvi =
    league.creators.find((c) => main && c.profile_id === main.id) ?? league.creators.find((c) => c.name.trim().toLowerCase() === "alvi")
  const member = (r: LeagueRow, lead = false): Member => {
    const c = byId.get(r.creatorId)
    const place = rows.indexOf(r) + 1
    return {
      key: String(r.creatorId),
      name: r.name,
      image: c?.skin_url || r.avatar,
      skin: !!c?.skin_url,
      color: r.color,
      plate: league.challenges.length ? `#${place} · ${r.leaguePoints} LP` : "Creator-Liga",
      href: "/liga",
      lead,
    }
  }
  // Platz 1 steht in der Mitte; daneben Alvi (egal auf welchem Platz) und die Bestplatzierten, nach Platz sortiert
  const others = rows.slice(1)
  const alviRow = others.find((r) => r.creatorId === alvi?.id)
  const side = [...(alviRow ? [alviRow] : []), ...others.filter((r) => r !== alviRow)].slice(0, 3).sort((a, b) => rows.indexOf(a) - rows.indexOf(b))
  const lead = rows.length ? member(rows[0], true) : null
  const [m1, m2, m3] = side.map((r) => member(r))

  // Reihenfolge links → rechts: dritter Seitenplatz · erster · PLATZ 1 · zweiter · Du
  return (
    <div className="relative">
      {/* Lichtkegel hinter der Party */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 mx-auto h-3/4 max-w-xl rounded-full bg-[radial-gradient(closest-side,#7fc4ff66,transparent)]" />
      <div className="relative flex items-end justify-center gap-1 sm:gap-3 lg:gap-1 xl:gap-3">
        <Slot m={m3} size="sm" />
        <Slot m={m1} size="md" />
        {lead ? <Slot m={lead} size="lg" /> : <EmptyStage />}
        <Slot m={m2} size="md" />
        <YouSlot viewer={viewer} />
      </div>
    </div>
  )
}

// Größen je Bildschirmbreite so gewählt, dass alle fünf Plätze nebeneinander passen (Handy 390 px bis Desktop-Mittelspalte)
const SIZES = {
  lg: {
    box: "w-24 sm:w-40 lg:w-[120px] xl:w-[168px] min-[1400px]:w-52",
    img: "h-24 w-24 sm:h-40 sm:w-40 lg:h-[120px] lg:w-[120px] xl:h-[168px] xl:w-[168px] min-[1400px]:h-52 min-[1400px]:w-52",
    skin: "h-44 sm:h-72 lg:h-60 xl:h-80 min-[1400px]:h-96",
  },
  md: {
    box: "w-16 sm:w-[104px] lg:w-20 xl:w-28 min-[1400px]:w-[136px]",
    img: "h-16 w-16 sm:h-[104px] sm:w-[104px] lg:h-20 lg:w-20 xl:h-28 xl:w-28 min-[1400px]:h-[136px] min-[1400px]:w-[136px]",
    skin: "h-28 sm:h-48 lg:h-40 xl:h-56 min-[1400px]:h-64",
  },
  sm: {
    box: "w-14 sm:w-20 lg:w-14 xl:w-20 min-[1400px]:w-24",
    img: "h-14 w-14 sm:h-20 sm:w-20 lg:h-14 lg:w-14 xl:h-20 xl:w-20 min-[1400px]:h-24 min-[1400px]:w-24",
    skin: "h-24 sm:h-40 lg:h-32 xl:h-44 min-[1400px]:h-52",
  },
}

function Slot({ m, size }: { m: Member | undefined; size: keyof typeof SIZES }) {
  const s = SIZES[size]
  if (!m) return <div className={s.box} aria-hidden />
  return (
    <Link href={m.href} className={clsx("group flex shrink-0 flex-col items-center", s.box, size === "sm" && "opacity-90")} title={`${m.name} – zur Creator-Liga`}>
      {m.lead && <span className="mb-1 text-xl leading-none drop-shadow sm:text-3xl">👑</span>}
      <div className="relative flex flex-col items-center">
        {m.image && m.skin ? (
          <img src={m.image} alt="" className={clsx(s.skin, "w-auto max-w-none object-contain drop-shadow-[0_10px_12px_rgba(0,0,0,.5)] transition group-hover:-translate-y-1")} />
        ) : (
          <span
            className={clsx(s.img, "relative block overflow-hidden rounded-full border-4 bg-panel-2 shadow-[0_0_30px_var(--glow)] transition group-hover:-translate-y-1")}
            style={{ borderColor: m.color, ["--glow" as string]: `${m.color}aa` }}
          >
            {m.image ? (
              <img src={m.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-3xl sm:text-5xl">{m.name.slice(0, 1)}</span>
            )}
          </span>
        )}
        {/* Plattform */}
        <span
          className={clsx("-mt-2 h-4 w-[115%] rounded-[50%] sm:h-6", m.lead ? "bg-accent/70 shadow-[0_0_30px_#ffe03d]" : "bg-accent-2/50 shadow-[0_0_20px_#3fd0ff]")}
          aria-hidden
        />
      </div>
      <Plate name={m.name} sub={m.plate} lead={m.lead} />
    </Link>
  )
}

function Plate({ name, sub, lead }: { name: string; sub: string; lead?: boolean }) {
  return (
    <span
      className={clsx(
        "mt-2 w-full -skew-x-6 border-l-4 px-1.5 py-0.5 text-center shadow-lg sm:px-2 sm:py-1",
        lead ? "border-accent bg-black/70" : "border-accent-2 bg-black/55",
      )}
    >
      <span className={clsx("block truncate font-display leading-tight", lead ? "text-sm text-accent sm:text-xl" : "text-[11px] sm:text-base")}>{name}</span>
      <span className="block truncate text-[9px] font-semibold text-white/75 sm:text-xs">{sub}</span>
    </span>
  )
}

/** Eigener Platz in der Party */
function YouSlot({ viewer }: { viewer: Viewer }) {
  const s = SIZES.sm
  if (viewer) {
    return (
      <Link href={viewer.login ? `/profil/${viewer.login}` : "/"} className={clsx("group flex shrink-0 flex-col items-center opacity-90", s.box)} title="Mein Profil">
        <span className={clsx(s.img, "block overflow-hidden rounded-full border-4 border-white/60 bg-panel-2 transition group-hover:-translate-y-1")}>
          {viewer.avatar ? <img src={viewer.avatar} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-3xl">👤</span>}
        </span>
        <span className="-mt-2 h-4 w-[115%] rounded-[50%] bg-white/25 sm:h-6" aria-hidden />
        <Plate name={viewer.name} sub="Du" />
      </Link>
    )
  }
  return (
    <div className={clsx("flex shrink-0 flex-col items-center", s.box)} title="Mit Twitch einloggen, um mitzuspielen">
      <span className={clsx(s.img, "flex items-center justify-center rounded-full border-4 border-dashed border-white/35 bg-black/20 text-3xl text-white/60 sm:text-5xl")}>+</span>
      <span className="-mt-2 h-4 w-[115%] rounded-[50%] bg-white/15 sm:h-6" aria-hidden />
      <Plate name="Du?" sub="Einloggen & mitspielen" />
    </div>
  )
}

function EmptyStage() {
  return (
    <div className={clsx("flex flex-col items-center", SIZES.lg.box)}>
      <span className="font-logo text-4xl text-accent drop-shadow-lg sm:text-6xl">ALVI</span>
      <span className="mt-2 h-4 w-[115%] rounded-[50%] bg-accent/70 shadow-[0_0_30px_#ffe03d] sm:h-6" aria-hidden />
    </div>
  )
}

/** Platzhalter in gleicher Höhe, solange die Liga lädt */
export function PartySkeleton() {
  return (
    <div className="flex items-end justify-center gap-1 sm:gap-3 lg:gap-1 xl:gap-3" aria-hidden>
      {(["sm", "md", "lg", "md", "sm"] as const).map((s, i) => (
        <div key={i} className={clsx("flex flex-col items-center", SIZES[s].box)}>
          <span className={clsx(SIZES[s].img, "animate-pulse rounded-full bg-white/10")} />
          <span className="mt-2 h-4 w-[115%] rounded-[50%] bg-white/10 sm:h-6" />
          <span className="mt-2 h-8 w-full animate-pulse bg-black/30 sm:h-11" />
        </div>
      ))}
    </div>
  )
}
