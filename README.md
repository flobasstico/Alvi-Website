# Alvi Challenges

Website für Alvis Fortnite-Challenges: konstruieren, auswürfeln, abstimmen und tracken. Gespielt wird in Fortnite. Die Seite wird per Screen-Share im Stream oder Video gezeigt.

| Seite | Funktion |
|---|---|
| `/rad` | **Challenge-Glücksrad**: gewichtete Regeln, mehrfach drehen stapelt die Regeln |
| `/loadout` | **Loadout-Würfel**: 5 Slots aus dem Loot-Pool der aktuellen Season, Slots sperren oder einzeln neu würfeln, Raritäts-Filter, Heilung garantiert |
| `/drop` | **Drop-Spot-Roulette**: zufälliger Landeort auf der Map plus Zusatzregel |
| `/voting` | **Community-Voting**: Zuschauer reichen Challenges ein (max. 3 pro Woche) und voten. Die Top 3 der Woche werden übernommen. Dazu gibt es die „Erledigt/Gescheitert“-Wand |
| `/versus` | **Versus-Scoreboard**: Live-Punktestand, synchroner Timer und Checkliste für Duelle gegen andere Creator |
| `/bingo` | **Bingo**: Alvis 5×5-Karte. Zuschauer holen sich eigene Karten, Felder werden live abgehakt, mit Bestenliste |
| `/stats` | **Challenge-Stats**: Erfolgsquote („Alvi hat 23 % geschafft“), Serien, Aufschlüsselung je Tool |
| `/admin` | Regeln, Loot-Pool, Drop-Spots, Bingo-Aufgaben, Seasons/Map, Ergebnisse eintragen |

**Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS 4, framer-motion, Supabase (Postgres + RLS, Auth mit Twitch, Realtime, Storage).

## Lokale Entwicklung

```bash
npm install
cp .env.example .env.local   # Supabase-URL + Publishable Key
npm run dev                  # http://localhost:3000
```

Checks: `npm run lint`, `npm run typecheck`, `npm test` (Vitest), `npm run build`.

## Einrichtung (einmalig)

### 1. Supabase
Das Projekt **Alvi** (`bvkpbqsmwmaczqfxvvgn`, eu-central-1) ist schon angelegt. Migrationen und Startdaten sind eingespielt. Für ein neues Projekt spielst du `supabase/migrations/*.sql` in dieser Reihenfolge ein und danach `supabase/seed.sql`.

### 2. Twitch-Login
1. Unter <https://dev.twitch.tv/console/apps> eine Anwendung registrieren.
   - OAuth-Redirect-URL: `https://bvkpbqsmwmaczqfxvvgn.supabase.co/auth/v1/callback`
   - Kategorie: Website Integration
2. Im Supabase-Dashboard unter **Authentication → Sign In / Providers → Twitch** den Provider aktivieren und Client-ID und Client-Secret eintragen.
3. Unter **Authentication → URL Configuration** die Site-URL (z. B. `https://alvi.vercel.app`) eintragen. Dazu kommen als Redirect-URLs `https://<deine-domain>/auth/callback` und für lokal `http://localhost:3000/auth/callback`.

### 3. Alvi zum Admin machen
Alvi loggt sich einmal mit Twitch ein. Danach führst du im Supabase SQL-Editor aus:

```sql
update public.profiles set role = 'admin' where twitch_login = 'alvis_twitch_name';
```

### 4. Deployment (Vercel)
Das Repo in Vercel importieren und die Umgebungsvariablen `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` setzen (Werte wie in `.env.example`).

## Ablauf im Stream

- **Rad, Loadout und Drop**: Als Admin erscheinen nach dem Wurf die Buttons „Challenge starten“ und „Für später merken“. Das Ergebnis (geschafft/gescheitert, Video-Link) trägst du unter `/admin` ein.
- **Voting**: Mit „Top 3 übernehmen“ werden die Vorschläge zu Challenges. Auf der Wand markierst du sie als geschafft oder gescheitert. Die Woche wechselt montags um 00:00 Uhr (Europe/Berlin).
- **Versus**: Duell unter `/versus` anlegen und die Seite `/versus/<id>` teilen. Alle Zuschauer sehen Punkte, Timer und Checkliste live. „Alvi gewinnt“ oder „Alvi verliert“ trägt das Ergebnis in die Stats ein.
- **Bingo**: Unter `/bingo` eine neue Runde starten (mind. 25 aktive Aufgaben). Zuschauer holen sich ihre Karte. Alvi hakt erledigte Aufgaben ab. „Runde beenden & werten“ zählt die Runde als geschafft, wenn Alvis Karte ein Bingo hat.
- **Neue Season**: Unter `/admin?tab=seasons` die Season anlegen. Loot-Pool, Spots und Map werden optional übernommen. Danach lädst du die neue Map hoch und setzt die Spots per Klick auf die Karte.

## Sicherheit

Schreibrechte erzwingt die Datenbank per Row Level Security. Stammdaten und Live-Tools darf nur `role = 'admin'` ändern. Zuschauer dürfen nur eigene Einreichungen, Votes und Bingo-Karten anlegen. Die Kalenderwoche einer Einreichung setzt der Server. Bingo-Gewinner berechnet ein Datenbank-Trigger, sodass niemand den Status fälschen kann.
