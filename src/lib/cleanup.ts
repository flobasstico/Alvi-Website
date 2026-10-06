/** Nach so vielen Tagen löscht die Datenbank nicht beendete Runden ohne Admin (siehe cleanup_stale_rounds) */
export const STALE_DAYS = { eskalation: 2, winchallenge: 2, bingo: 2, loadout: 2, auktion: 2, olympiade: 4 } as const
export type StaleGame = keyof typeof STALE_DAYS

export const staleText = (game: StaleGame) =>
  `Nicht beendete Runden ohne Admin werden nach ${STALE_DAYS[game]} Tagen automatisch gelöscht.`
