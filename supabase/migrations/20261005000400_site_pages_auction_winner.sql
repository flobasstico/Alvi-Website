-- 1) Seiten-Einstellungen für Admins: Kanal-Links, Impressum, Datenschutzerklärung (in site_settings)
-- 2) Loot-Auktion bekommt einen Sieger (wie Regel-Eskalation und Loadout-Würfel)

-- ---------- Seiten-Einstellungen ----------
-- Admins dürfen nur die Seiten-Schlüssel ändern, nicht main_creator_login (steuert Alvis Statistik)
create policy "admin schreiben" on public.site_settings for insert to authenticated
  with check ((select public.is_admin()) and (key like 'link\_%' or key in ('impressum', 'datenschutz')));
create policy "admin aendern" on public.site_settings for update to authenticated
  using ((select public.is_admin()) and (key like 'link\_%' or key in ('impressum', 'datenschutz')))
  with check ((select public.is_admin()) and (key like 'link\_%' or key in ('impressum', 'datenschutz')));
create policy "admin loeschen" on public.site_settings for delete to authenticated
  using ((select public.is_admin()) and (key like 'link\_%' or key in ('impressum', 'datenschutz')));

insert into public.site_settings (key, value) values
  ('link_twitch', 'https://www.twitch.tv/alvivb'),
  ('impressum', $txt$## Angaben gemäß § 5 DDG
[Vorname Nachname]
[Straße Hausnummer]
[PLZ Ort]
[Land]

## Kontakt
E-Mail: [E-Mail-Adresse]
Telefon: [Telefonnummer – optional, alternativ ein weiterer schneller Kontaktweg]

## Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
[Vorname Nachname]
[Anschrift wie oben]$txt$),
  ('datenschutz', $txt$## Verantwortlicher
[Vorname Nachname]
[Anschrift]
E-Mail: [E-Mail-Adresse]

## Hosting
Diese Website wird bei Vercel Inc. gehostet. Beim Aufruf verarbeitet der Hoster technisch notwendige Daten (z. B. IP-Adresse, Zeitpunkt, aufgerufene Seite) in Server-Logs. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (sicherer Betrieb der Website).

## Datenbank und Anmeldung
Daten der Website (z. B. Challenges, Spielstände, Bingo-Karten) werden bei Supabase (Rechenzentrum Frankfurt, EU) gespeichert. Die Anmeldung erfolgt freiwillig über Twitch. Dabei erhalten wir von Twitch deinen Twitch-Namen, Anzeigenamen und dein Profilbild; diese Daten werden bei Spielteilnahmen angezeigt. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzung der Mitspiel-Funktionen).

## Twitch-Chat
Im Spezialmodus „Chat-Abstimmung“ liest die Website öffentliche Chat-Nachrichten im Kanal des Streamers und speichert Twitch-Namen und abgegebene Stimme (!1/!2/!3) für die Auswertung.

## Cookies und lokaler Speicher
Es werden nur technisch notwendige Cookies für die Anmeldung gesetzt. Einstellungen wie Spielernamen oder Ton an/aus speichert dein Browser lokal (localStorage); diese Daten verlassen dein Gerät nicht. Es gibt kein Tracking und keine Werbung.

## Deine Rechte
Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde. Wende dich dazu an die oben genannte E-Mail-Adresse.$txt$)
on conflict (key) do nothing;

-- ---------- Loot-Auktion: Sieger ----------
alter table public.auctions
  add column winner_id uuid references public.profiles (id) on delete set null,
  add column winner_name text,
  add column result text check (result in ('geschafft', 'gescheitert')),
  add column decided_at timestamptz;   -- Wertung abgeschlossen (mit oder ohne Sieger)
create index auctions_winner_idx on public.auctions (winner_id);

-- Nach dem Spiel: Host wählt den Sieger (Spieler am Tisch) oder beendet ohne Wertung (p_winner = null).
-- Für Alvis Quote zählt ein Alvi-Sieg als geschafft.
create or replace function public.auction_set_winner(p_auction bigint, p_winner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.auctions;
  w public.auction_players;
  res text;
  ch bigint;
begin
  select * into a from public.auctions where id = p_auction for update;
  if a.id is null then raise exception 'Auktion nicht gefunden'; end if;
  if a.host_id is distinct from auth.uid() then raise exception 'Nur wer die Auktion eröffnet hat, wählt den Sieger'; end if;
  if a.status <> 'beendet' then raise exception 'Die Auktion läuft noch'; end if;
  if a.decided_at is not null then raise exception 'Der Sieger steht schon fest'; end if;

  if p_winner is not null then
    select * into w from public.auction_players where auction_id = p_auction and user_id = p_winner;
    if w.user_id is null then raise exception 'Der Sieger muss in der Auktion mitgespielt haben'; end if;
    res := case when public.is_main_creator(p_winner) then 'geschafft' else 'gescheitert' end;
    if a.challenge_id is not null then
      update public.challenges set status = res, title = title || ' – ' || w.display_name || ' gewinnt' where id = a.challenge_id;
      ch := a.challenge_id;
    else
      insert into public.challenges (title, source, status, played_at, config)
      values (
        'Loot-Auktion' || coalesce(': ' || a.title, '') || ' – ' || w.display_name || ' gewinnt',
        'auktion', res, coalesce(a.ended_at, now()),
        jsonb_build_object(
          'auction_id', a.id, 'winner', w.display_name,
          'players', (select coalesce(jsonb_agg(display_name order by seat), '[]'::jsonb) from public.auction_players where auction_id = p_auction)
        )
      )
      returning id into ch;
    end if;
  end if;

  update public.auctions
     set winner_id = p_winner, winner_name = w.display_name, result = res, decided_at = now(), challenge_id = coalesce(ch, challenge_id)
   where id = p_auction;
end;
$$;

revoke execute on function public.auction_set_winner(bigint, uuid) from public, anon;
grant execute on function public.auction_set_winner(bigint, uuid) to authenticated;
