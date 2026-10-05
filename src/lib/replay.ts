import type { Json } from "./database.types"

type ChallengeLike = { id: number; source: string; status: string; config: Json }

const obj = (c: Json): Record<string, Json> => (c && typeof c === "object" && !Array.isArray(c) ? (c as Record<string, Json>) : {})

/** Link zum Nachspielen einer abgeschlossenen Challenge (Auktion/Loadout: keine Nachspiel-Option) */
export function replayHref(c: ChallengeLike): string | null {
  if (c.status !== "geschafft" && c.status !== "gescheitert") return null
  const cfg = obj(c.config)
  switch (c.source) {
    case "rad":
      return Array.isArray(cfg.rules) && cfg.rules.length ? `/rad?nachspielen=${c.id}` : null
    case "drop":
      return Array.isArray(cfg.circles) && cfg.circles.length ? `/drop?nachspielen=${c.id}` : null
    case "eskalation":
      return typeof cfg.session_id === "number" ? `/eskalation/${cfg.session_id}` : null
    case "bingo":
      return typeof cfg.round_id === "number" ? `/bingo/${cfg.round_id}` : null
    case "winchallenge":
      return typeof cfg.win_challenge_id === "number" ? `/winchallenge/${cfg.win_challenge_id}` : null
    default:
      return null
  }
}

export type ReplayCircle = { player: string; spot: string; cx: number; cy: number; r: number }

/** Gespeicherte Drop-Kreise (alte Einträge ohne Kreise → leer) */
export function dropCircles(config: Json): { circles: ReplayCircle[]; rule: string | null } {
  const cfg = obj(config)
  const circles = (Array.isArray(cfg.circles) ? cfg.circles : []).flatMap((x) => {
    const o = obj(x)
    const [cx, cy, r] = [Number(o.cx), Number(o.cy), Number(o.r)]
    return Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(r) ? [{ player: String(o.player ?? ""), spot: String(o.spot ?? ""), cx, cy, r }] : []
  })
  return { circles, rule: typeof cfg.rule === "string" ? cfg.rule : null }
}

export function radRules(config: Json): string[] {
  const rules = obj(config).rules
  return Array.isArray(rules) ? rules.map(String) : []
}
