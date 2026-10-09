import Link from "next/link"
import { Suspense } from "react"
import { ChannelLinks } from "@/components/channel-links"
import { LiveBanner } from "@/components/live-banner"
import { Party, PartySkeleton } from "@/components/lobby/party"
import { Quests, QuestsSkeleton } from "@/components/lobby/quests"
import { SelectedMode } from "@/components/lobby/selected-mode"
import { gameThumbs } from "@/lib/games"
import { getCurrentSeason } from "@/lib/season"
import { channelsFromSettings, loadSiteSettings, safeUrl } from "@/lib/site"
import { getViewer } from "@/lib/supabase/server"

/**
 * Startseite als Fortnite-Lobby: links Titel, Kanäle und Aufträge (Stats), in der Mitte die Party
 * (Alvi + Top-Creator der Liga), rechts der ausgewählte Modus mit SPIELEN. Am Handy untereinander.
 */
export default async function Lobby() {
  const { supabase, profile } = await getViewer()
  const [{ data: active }, settings, season] = await Promise.all([
    supabase.from("challenges").select("id, title").eq("status", "aktiv").order("played_at", { ascending: false }).limit(3),
    loadSiteSettings(supabase),
    getCurrentSeason(supabase),
  ])
  const channels = channelsFromSettings(settings)
  const mainLogin = settings.get("main_creator_login")?.trim() || "alvivb"
  const viewer = profile
    ? { name: profile.display_name ?? profile.twitch_login ?? "Du", avatar: profile.avatar_url, login: profile.twitch_login }
    : null

  // Desktop wie das Fortnite-HUD: Titel oben mittig, Party unten mittig, Aufträge/Kanäle links, Event/Modus rechts.
  // Am Handy der Reihe nach: Titel, Party, Modus, Event, Aufträge, Kanäle.
  return (
    <>
      {/* Lobby-Hintergrund: Fortnite-Landschaft, oben/unten abgedunkelt für lesbare Texte (am Handy kleinere Datei) */}
      <div
        aria-hidden
        className="lobby-bg pointer-events-none fixed inset-0 -z-10 bg-[url(/lobby-bg-mobil.webp)] bg-cover bg-[position:62%_center] sm:bg-[url(/lobby-bg.webp)] sm:bg-center"
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#05103acc_0%,#05103a55_30%,#05103a33_55%,#05103aaa_85%,#05103aee_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_45%,transparent_50%,#05103a99_100%)]" />
        {/* Logo-Ecke des Bildes (unten rechts) abdecken */}
        <div className="absolute inset-0 bg-[radial-gradient(28%_30%_at_100%_100%,#05103a_35%,transparent_100%)]" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:relative lg:left-1/2 lg:min-h-[calc(100dvh-10rem)] lg:w-[min(100vw-2rem,1400px)] lg:-translate-x-1/2 lg:grid-cols-[260px_minmax(0,1fr)_280px] lg:grid-rows-[auto_1fr_auto] xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <section className="text-center lg:col-start-2 lg:row-start-1">
          <h1 className="font-logo text-5xl leading-none text-accent drop-shadow-[0_4px_0_#0009] sm:text-6xl">
            ALVI <span className="text-white">CHALLENGES</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/85 sm:text-base">
            Stellt eure eigenen Fortnite-Challenges zusammen oder spielt die eures Lieblingscreators nach! Die Challenges der Creator werden
            sogar getrackt – wer ist der Beste?
          </p>
        </section>

        <section className="flex flex-col items-center gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-2 lg:justify-end">
          <Suspense fallback={<PartySkeleton />}>
            <Party mainLogin={mainLogin} viewer={viewer} />
          </Suspense>
          <div className="flex w-full min-w-0 justify-center empty:hidden">
            <Suspense fallback={null}>
              <LiveBanner login={mainLogin} />
            </Suspense>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md lg:col-start-3 lg:row-span-2 lg:row-start-2 lg:max-w-none lg:self-end">
          <SelectedMode thumbs={gameThumbs(settings, safeUrl)} mapUrl={season?.map_image_url ?? null} />
        </section>

        <Link
          href="/minispiele"
          className="flex items-center gap-3 self-start rounded-md border-2 border-[#ff5ccf]/70 bg-gradient-to-r from-[#7a1fa2] to-[#3b1a8f] px-3 py-2 shadow-lg hover:border-accent lg:col-start-3 lg:row-start-1"
        >
          <span className="text-3xl">🕹️</span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#ffc2f0]">Event</span>
            <span className="block font-display text-lg leading-tight">Schlag Alvis Highscore</span>
            <span className="block truncate text-xs text-white/80">Minispiele: Drop-Zone & Sturm-Lauf</span>
          </span>
        </Link>

        <section className="lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start">
          <Suspense fallback={<QuestsSkeleton />}>
            <Quests active={active ?? []} />
          </Suspense>
        </section>

        <section className="flex flex-col gap-3 lg:col-start-1 lg:row-start-3 lg:self-end">
          {channels.length > 0 && (
            <div className="panel p-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Kanäle</div>
              <div className="flex flex-wrap items-center gap-1">
                <ChannelLinks channels={channels} />
              </div>
            </div>
          )}
          <div className="panel flex items-center justify-between gap-3 p-3">
            <span className="text-[11px] font-bold uppercase leading-tight tracking-wider text-muted">
              Support-a-
              <br />
              Creator
            </span>
            <span className="font-display text-2xl tracking-wider text-accent">Alvivb</span>
          </div>
        </section>
      </div>
    </>
  )
}
