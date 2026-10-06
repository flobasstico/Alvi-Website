-- Mehrspieler-Runden für alle mit Twitch-Login: Regel-Eskalation, Loadout-Würfel und Loot-Auktion
-- (Bingo und Olympiade konnten das schon). Wie überall gilt: offiziell (Übersichten, Stats) ist eine Runde nur,
-- wenn ein Admin sie eröffnet oder mitspielt. Andere Runden werden beim Abschluss gelöscht,
-- nicht beendete nach 2 Tagen. Chat-Abstimmung (postet in einen Twitch-Chat) bleibt Admins vorbehalten.

alter table public.loadout_sessions add column official boolean not null default true;
alter table public.auctions add column official boolean not null default true;

-- ---------- offiziell = Host ist Admin oder ein Admin spielt mit ----------
create or replace function public.recompute_official()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid bigint;
begin
  if tg_table_name = 'loadout_players' then
    rid := coalesce(new.session_id, old.session_id);
    update public.loadout_sessions s set official =
      exists (select 1 from public.profiles where id = s.host_id and role = 'admin')
      or exists (select 1 from public.loadout_players p join public.profiles pr on pr.id = p.user_id where p.session_id = s.id and pr.role = 'admin')
     where s.id = rid and s.status <> 'beendet';
  elsif tg_table_name = 'auction_players' then
    rid := coalesce(new.auction_id, old.auction_id);
    update public.auctions a set official =
      exists (select 1 from public.profiles where id = a.host_id and role = 'admin')
      or exists (select 1 from public.auction_players p join public.profiles pr on pr.id = p.user_id where p.auction_id = a.id and pr.role = 'admin')
     where a.id = rid and a.decided_at is null;
  elsif tg_table_name = 'escalation_players' then
    rid := coalesce(new.session_id, old.session_id);
    update public.escalation_sessions s set official =
      exists (select 1 from public.profiles where id = s.host_id and role = 'admin')
      or exists (select 1 from public.escalation_players p join public.profiles pr on pr.id = p.user_id where p.session_id = s.id and pr.role = 'admin')
     where s.id = rid and s.status <> 'beendet';
  end if;
  return null;
end;
$$;
revoke execute on function public.recompute_official() from public, anon, authenticated;

create trigger recompute_official after insert or delete on public.loadout_players for each row execute function public.recompute_official();
create trigger recompute_official after insert or delete on public.auction_players for each row execute function public.recompute_official();
create trigger recompute_official after insert or delete on public.escalation_players for each row execute function public.recompute_official();

-- ---------- Loot-Auktion: anlegen für alle ----------
drop policy "admin insert" on public.auctions;
create policy "anlegen" on public.auctions for insert to authenticated
  with check (host_id = (select auth.uid()) and status = 'lobby');

-- „offiziell“ setzt immer die Datenbank, nie der Browser
create or replace function public.set_auction_official()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then new.official := public.is_admin(); end if;
  return new;
end;
$$;
revoke execute on function public.set_auction_official() from public, anon, authenticated;
create trigger set_auction_official before insert on public.auctions for each row execute function public.set_auction_official();

-- Sieger wählen: Runden ohne Admin werden dabei gelöscht
alter function public.auction_set_winner(bigint, uuid) rename to auction_set_winner_inner;
revoke execute on function public.auction_set_winner_inner(bigint, uuid) from public, anon, authenticated;
create function public.auction_set_winner(p_auction bigint, p_winner uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.auctions;
begin
  select * into a from public.auctions where id = p_auction;
  if a.id is null then raise exception 'Auktion nicht gefunden'; end if;
  if a.host_id is distinct from auth.uid() then raise exception 'Nur wer die Auktion eröffnet hat, wählt den Sieger'; end if;
  if not a.official then
    delete from public.auctions where id = p_auction;
    return 'geloescht';
  end if;
  perform public.auction_set_winner_inner(p_auction, p_winner);
  return 'beendet';
end;
$$;
revoke execute on function public.auction_set_winner(bigint, uuid) from public, anon;
grant execute on function public.auction_set_winner(bigint, uuid) to authenticated;

-- ---------- Loadout-Würfel: eröffnen für alle ----------
create or replace function public.loadout_create(p_title text, p_rarities text[], p_must_heal boolean, p_max_players int)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
  season bigint;
  rar text[];
begin
  if auth.uid() is null then raise exception 'Zum Spielen mit Twitch einloggen'; end if;
  select id into season from public.seasons where is_current limit 1;
  if season is null then raise exception 'Keine aktuelle Season'; end if;
  select coalesce(array_agg(distinct r), '{}') into rar
  from unnest(p_rarities) r where r in ('grau', 'gruen', 'blau', 'lila', 'gold', 'mythisch');
  if cardinality(rar) = 0 then raise exception 'Mindestens eine Seltenheit wählen'; end if;
  insert into public.loadout_sessions (title, season_id, rarities, must_heal, max_players, official)
  values (nullif(trim(p_title), ''), season, rar, coalesce(p_must_heal, true), greatest(2, least(8, coalesce(p_max_players, 4))), public.is_admin())
  returning id into new_id;
  perform public.loadout_join(new_id);
  return new_id;
end;
$$;

alter function public.loadout_finish(bigint, uuid) rename to loadout_finish_inner;
revoke execute on function public.loadout_finish_inner(bigint, uuid) from public, anon, authenticated;
create function public.loadout_finish(p_session bigint, p_winner uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.loadout_sessions;
begin
  select * into s from public.loadout_sessions where id = p_session;
  if s.id is null then raise exception 'Runde nicht gefunden'; end if;
  if s.host_id is distinct from auth.uid() then raise exception 'Nur wer die Runde eröffnet hat, darf sie beenden'; end if;
  if not s.official then
    delete from public.loadout_sessions where id = p_session;
    return 'geloescht';
  end if;
  perform public.loadout_finish_inner(p_session, p_winner);
  return 'beendet';
end;
$$;
revoke execute on function public.loadout_finish(bigint, uuid) from public, anon;
grant execute on function public.loadout_finish(bigint, uuid) to authenticated;

-- ---------- Regel-Eskalation: eröffnen für alle (Chat-Abstimmung nur Admins) ----------
create or replace function public.escalation_create(p_title text, p_interval_s int, p_mode text, p_channel text, p_max_players int)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
  chan text := lower(nullif(trim(p_channel), ''));
begin
  if auth.uid() is null then raise exception 'Zum Spielen mit Twitch einloggen'; end if;
  if not exists (select 1 from public.escalation_rules where active and kind = 'grund') then
    raise exception 'Der Grundregel-Pool ist leer – zuerst Grundregeln im Admin-Bereich anlegen';
  end if;
  if not exists (select 1 from public.escalation_rules where active and kind = 'zusatz') then
    raise exception 'Der Zusatzregel-Pool ist leer – zuerst Zusatzregeln im Admin-Bereich anlegen';
  end if;
  if p_mode not in ('zufall', 'chat') then raise exception 'Unbekannter Modus'; end if;
  if p_mode = 'chat' then
    if not public.is_admin() then raise exception 'Die Chat-Abstimmung können nur Admins starten'; end if;
    chan := coalesce(chan, (select value from public.site_settings where key = 'main_creator_login'));
    if chan is null or chan !~ '^[a-z0-9_]{3,25}$' then raise exception 'Ungültiger Twitch-Kanal'; end if;
  else
    chan := null;
  end if;
  insert into public.escalation_sessions (title, interval_s, mode, twitch_channel, max_players, official)
  values (
    nullif(trim(p_title), ''), greatest(30, least(3600, coalesce(p_interval_s, 240))), p_mode, chan,
    greatest(2, least(8, coalesce(p_max_players, 4))), public.is_admin()
  )
  returning id into new_id;
  perform public.escalation_join(new_id);
  return new_id;
end;
$$;

-- ---------- Aufräumen: auch Loadout- und Auktions-Runden ohne Admin (2 Tage) ----------
create or replace function public.cleanup_stale_rounds()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.escalation_sessions where not official and status <> 'beendet' and created_at < now() - interval '2 days';
  delete from public.win_challenges where not official and status <> 'beendet' and created_at < now() - interval '2 days';
  delete from public.bingo_rounds where not official and status <> 'beendet' and created_at < now() - interval '2 days';
  delete from public.loadout_sessions where not official and status <> 'beendet' and created_at < now() - interval '2 days';
  delete from public.auctions where not official and decided_at is null and created_at < now() - interval '2 days';
  delete from public.olympics where not official and status <> 'beendet' and created_at < now() - interval '4 days';
end;
$$;
create trigger cleanup_stale after insert on public.loadout_sessions for each statement execute function public.cleanup_stale_rounds_trigger();
create trigger cleanup_stale after insert on public.auctions for each statement execute function public.cleanup_stale_rounds_trigger();
