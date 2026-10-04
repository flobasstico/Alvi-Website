# Alvi Challenges

Website für Alvis Fortnite-Challenges: konstruieren, auswürfeln, abstimmen und tracken. Gespielt wird in Fortnite. Die Seite wird per Screen-Share im Stream oder Video gezeigt.

| Seite | Funktion |
|---|---|
| `/rad` | **Challenge-Glücksrad**: gewichtete Regeln, mehrfach drehen stapelt die Regeln |
| `/loadout` | **Loadout-Würfel**: 5 Slots aus dem Loot-Pool der aktuellen Season, Slots sperren oder einzeln neu würfeln, Raritäts-Filter, Heilung garantiert |
| `/drop` | **Drop-Spot-Roulette**: zufälliger Landeort auf der Map plus Zusatzregel |
| `/bingo` | **Bingo**: Alvis 5×5-Karte. Zuschauer holen sich eigene Karten, Felder werden live abgehakt, mit Bestenliste |
| `/auktion` | **Loot-Auktion**: 4 Creator mit je 500 Gold bieten verdeckt am eigenen Gerät auf zufällige Items. Der Höchstbieter gewinnt, bei Gleichstand entscheidet das Los. Haben alle geskippt, wird das Item verworfen. Gespielt wird, bis jeder 5 Items hat. Am Ende gibt es eine Loadout-Übersicht als Bild |
| `/eskalation` | **Regel-Eskalation**: Grundregel per Glücksrad, danach kommt alle 4 Minuten (einstellbar) eine neue Zufallsregel dazu, mit Alarm-Ton. Die Regelkachel gibt es als OBS-Overlay |
| `/stats` | **Challenge-Stats** (über das Menü): Erfolgsquote („Alvi hat 23 % geschafft“), Serien, Aufschlüsselung je Tool |
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

### 3. Admins festlegen
Admin-Rechte vergibt eine Liste von Twitch-Namen in der Tabelle `admin_logins`. Wer dort steht, wird beim ersten Twitch-Login automatisch Admin. Hat er sich schon eingeloggt, wird er sofort befördert. `flobasstico` und `alvivb` sind bereits eingetragen. Weitere Admins trägst du im Supabase SQL-Editor so nach (Twitch-Name kleingeschrieben):

```sql
insert into public.admin_logins (twitch_login) values ('twitch_name');
```

### 4. Deployment (Vercel)
Das Repo in Vercel importieren und die Umgebungsvariablen `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` setzen (Werte wie in `.env.example`).

## Ablauf im Stream

- **Rad, Loadout und Drop**: Als Admin erscheinen nach dem Wurf die Buttons „Challenge starten“ und „Für später merken“. Das Ergebnis (geschafft/gescheitert, Video-Link) trägst du unter `/admin` ein.
- **Bingo**: Unter `/bingo` eine neue Runde starten (mind. 25 aktive Aufgaben). Zuschauer holen sich ihre Karte. Alvi hakt erledigte Aufgaben ab. „Runde beenden & werten“ zählt die Runde als geschafft, wenn Alvis Karte ein Bingo hat.
- **Loot-Auktion**: Unter `/auktion` eine Lobby öffnen und dabei Startgold, Items pro Spieler, Bietzeit, Seltenheiten und „Keine Duplikate“ einstellen. Den Einladungslink an die anderen Creator schicken, die sich mit Twitch einloggen und Platz nehmen. Starten kann man ab 2 Spielern. Jeder sieht nur sein eigenes Gebot, bis alle gehandelt haben oder die Bietzeit abläuft (dann wird automatisch geskippt). Das Mindestgebot ist 10 Gold. Wer weniger als 10 Gold hat, bietet nicht mehr mit. Seine offenen Slots werden am Ende der Auktion zufällig aus dem Pool zugelost, gratis und im Abschluss-Screen mit 🎲 markiert. Mit „Keine Duplikate“ kommen bereits gewonnene oder zugeloste Items nicht mehr vor. Reicht der Pool nicht, endet die Auktion vorzeitig. Bilder für die Items pflegst du unter `/admin?tab=loot`.
- **Regel-Eskalation**: Den Regelpool pflegst du unter `/admin?tab=eskalation` (er startet leer). Unter `/eskalation` eröffnet ein Admin eine Runde, dreht das Glücksrad für die Grundregel und drückt nach dem gemeinsamen Spielstart auf **Start**. Danach kommt nach jedem Ablauf des Timers automatisch eine neue Zufallsregel dazu, ohne Wiederholungen, solange der Pool reicht. Den Overlay-Link `/overlay/eskalation/<id>` (auf der Rundenseite zum Kopieren) bindet jeder Teilnehmer als OBS-Browserquelle ein: Der Hintergrund ist transparent, der Alarm läuft über OBS. Auf der Website muss man den Ton einmal per Klick aktivieren. Mitspieler treten über den Seitenlink bei, Twitch-Login nötig. Der Host ist automatisch dabei und kann Mitspieler entfernen. Mit **⏹ Ende** beendet der Host die Runde und wählt den Sieger aus den Mitspielern, alternativ ohne Wertung. Siege erscheinen in den Stats in der Bestenliste „Regel-Eskalation – Siege“. Für Alvis Erfolgsquote zählt ein Alvi-Sieg als geschafft, jeder andere Sieger als gescheitert. Wer als Alvi gilt, steht in `site_settings` (`main_creator_login = alvivb`).
- **Regel-Eskalation mit Chat-Abstimmung**: Beim Eröffnen den Modus **Chat-Abstimmung** wählen (Twitch-Kanal, Standard `alvivb`). Ab dem Start stimmt der Twitch-Chat über jede neue Regel ab: Die Website postet 3 Optionen in den Chat, Zuschauer schreiben `!1`, `!2` oder `!3`. Jeder hat eine Stimme, die letzte zählt. Nach Ablauf des Timers gewinnt die Option mit den meisten Stimmen; bei Gleichstand entscheidet das Los, ohne Stimmen der Zufall. Die Gewinner-Regel wird mit Alarm eingeblendet, das Ergebnis geht in den Chat, und die nächste Abstimmung startet. Overlay und Regelkachel zeigen die Abstimmung mit Live-Balken.
  - Die **Chat-Brücke** läuft im Browser des Hosts: Die Rundenseite muss während der Runde offen bleiben, z. B. in einem Nebenfenster.
  - **Mit Twitch-Chat verbinden** holt einmalig die Twitch-Rechte „Chat lesen und schreiben“ (`chat:read chat:edit`). Danach postet die Seite unter dem Twitch-Namen des Hosts. Das Token gilt etwa 4 Stunden. Ohne diese Rechte zählt die Seite trotzdem die Stimmen und zeigt den Abstimmungstext zum Kopieren.
- **Lootpool pflegen** (`/admin?tab=loot`): Unter „Lootpool aktualisieren“ fügst du eine Liste ein, z. B. `• Pump Shotgun (Legendary)`. Überschriften wie „Waffen“, „Healing & Consumables“ oder „Mobility & Utility“ setzen den Typ. Die Seltenheit steht in Klammern, auf Englisch oder Deutsch. „Pool ersetzen“ tauscht den Pool der Season aus, „Nur hinzufügen“ ergänzt ihn und überspringt Duplikate. Jede Seltenheit hat ihr eigenes Bild: Klickst du auf das Bildfeld einer Variante, lädst du ihr Bild hoch. Klickst du auf den Namen der Seltenheit darunter (✎), kannst du die Variante bearbeiten, deaktivieren oder löschen. Beim Import bleiben Bilder pro Item und Seltenheit erhalten. Die aktuelle Liste liegt unter `supabase/loot/aktuelle-season.txt`.
- **Neue Season**: Unter `/admin?tab=seasons` die Season anlegen. Loot-Pool, Spots und Map werden optional übernommen. Danach lädst du die neue Map hoch und setzt die Spots per Klick auf die Karte.

## Sicherheit

Schreibrechte erzwingt die Datenbank per Row Level Security. Stammdaten und Live-Tools darf nur `role = 'admin'` ändern. Zuschauer dürfen nur eigene Bingo-Karten anlegen und an Auktionen teilnehmen. Bingo-Gewinner berechnet ein Datenbank-Trigger, sodass niemand den Status fälschen kann. Bei der Loot-Auktion laufen Item-Ziehung, Gebotsprüfung (Mindestgebot, 10er-Schritte, Gold-Limit, ein Gebot pro Runde), Losentscheid, Gold-Abzug und die Auslosung am Ende komplett in Datenbankfunktionen. Fremde Gebote sind per RLS bis zur Auswertung unsichtbar.
