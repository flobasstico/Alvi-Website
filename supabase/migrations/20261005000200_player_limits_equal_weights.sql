-- 1) Spieleranzahl für alle Mehrspieler-Challenges einstellbar (2–8, Standard 4):
--    Loot-Auktion (bisher fest 2–4), Regel-Eskalation und Loadout-Würfel (bisher unbegrenzt).
-- 2) Glücksrad/Drop-Regeln: alle Gewichte gleich (1).

-- ---------- Loot-Auktion: bis zu 8 Plätze ----------
alter table public.auctions drop constraint auctions_max_players_check;
alter table public.auctions add constraint auctions_max_players_check check (max_players between 2 and 8);
alter table public.auction_players drop constraint auction_players_seat_check;
alter table public.auction_players add constraint auction_players_seat_check check (seat between 1 and 8);

-- ---------- Regel-Eskalation ----------
alter table public.escalation_sessions
  add column max_players int not null default 4 check (max_players between 2 and 8);
-- Bestehende Runden nicht nachträglich einschränken
update public.escalation_sessions s
   set max_players = greatest(4, least(8, (select count(*) from public.escalation_players p where p.session_id = s.id)));

create or replace function public.escalation_join(p_session bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.escalation_sessions;
  prof public.profiles;
begin
  if auth.uid() is null then raise exception 'Bitte einloggen'; end if;
  select * into s from public.escalation_sessions where id = p_session for update;
  if s.id is null then raise exception 'Runde nicht gefunden'; end if;
  if s.status = 'beendet' then raise exception 'Die Runde ist schon beendet'; end if;
  if exists (select 1 from public.escalation_players where session_id = p_session and user_id = auth.uid()) then return; end if;
  if (select count(*) from public.escalation_players where session_id = p_session) >= s.max_players then
    raise exception 'Alle % Plätze sind belegt', s.max_players;
  end if;
  select * into prof from public.profiles where id = auth.uid();
  insert into public.escalation_players (session_id, user_id, display_name, avatar_url)
  values (p_session, auth.uid(), coalesce(prof.display_name, prof.twitch_login, 'Spieler'), prof.avatar_url)
  on conflict do nothing;
end;
$$;

drop function public.escalation_create(text, int, text, text);
create function public.escalation_create(p_title text, p_interval_s int, p_mode text, p_channel text, p_max_players int)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
  chan text := lower(nullif(trim(p_channel), ''));
begin
  if not public.is_admin() then raise exception 'Nur Admins können eine Regel-Eskalation eröffnen'; end if;
  if not exists (select 1 from public.escalation_rules where active and kind = 'grund') then
    raise exception 'Der Grundregel-Pool ist leer – zuerst Grundregeln im Admin-Bereich anlegen';
  end if;
  if not exists (select 1 from public.escalation_rules where active and kind = 'zusatz') then
    raise exception 'Der Zusatzregel-Pool ist leer – zuerst Zusatzregeln im Admin-Bereich anlegen';
  end if;
  if p_mode not in ('zufall', 'chat') then raise exception 'Unbekannter Modus'; end if;
  if p_mode = 'chat' then
    chan := coalesce(chan, (select value from public.site_settings where key = 'main_creator_login'));
    if chan is null or chan !~ '^[a-z0-9_]{3,25}$' then raise exception 'Ungültiger Twitch-Kanal'; end if;
  else
    chan := null;
  end if;
  insert into public.escalation_sessions (title, interval_s, mode, twitch_channel, max_players)
  values (
    nullif(trim(p_title), ''), greatest(30, least(3600, coalesce(p_interval_s, 240))), p_mode, chan,
    greatest(2, least(8, coalesce(p_max_players, 4)))
  )
  returning id into new_id;
  perform public.escalation_join(new_id);
  return new_id;
end;
$$;

-- ---------- Loadout-Würfel Mehrspieler ----------
alter table public.loadout_sessions
  add column max_players int not null default 4 check (max_players between 2 and 8);
update public.loadout_sessions s
   set max_players = greatest(4, least(8, (select count(*) from public.loadout_players p where p.session_id = s.id)));

create or replace function public.loadout_join(p_session bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.loadout_sessions;
  prof public.profiles;
begin
  if auth.uid() is null then raise exception 'Bitte einloggen'; end if;
  select * into s from public.loadout_sessions where id = p_session for update;
  if s.id is null then raise exception 'Runde nicht gefunden'; end if;
  if s.status <> 'offen' then raise exception 'Die Runde läuft schon – beitreten geht nur vor dem Start'; end if;
  if exists (select 1 from public.loadout_players where session_id = p_session and user_id = auth.uid()) then return; end if;
  if (select count(*) from public.loadout_players where session_id = p_session) >= s.max_players then
    raise exception 'Alle % Plätze sind belegt', s.max_players;
  end if;
  select * into prof from public.profiles where id = auth.uid();
  insert into public.loadout_players (session_id, user_id, display_name, avatar_url)
  values (p_session, auth.uid(), coalesce(prof.display_name, prof.twitch_login, 'Spieler'), prof.avatar_url)
  on conflict do nothing;
end;
$$;

drop function public.loadout_create(text, text[], boolean);
create function public.loadout_create(p_title text, p_rarities text[], p_must_heal boolean, p_max_players int)
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
  if not public.is_admin() then raise exception 'Nur Admins können eine Loadout-Runde eröffnen'; end if;
  select id into season from public.seasons where is_current limit 1;
  if season is null then raise exception 'Keine aktuelle Season'; end if;
  select coalesce(array_agg(distinct r), '{}') into rar
  from unnest(p_rarities) r where r in ('grau', 'gruen', 'blau', 'lila', 'gold', 'mythisch');
  if cardinality(rar) = 0 then raise exception 'Mindestens eine Seltenheit wählen'; end if;
  insert into public.loadout_sessions (title, season_id, rarities, must_heal, max_players)
  values (nullif(trim(p_title), ''), season, rar, coalesce(p_must_heal, true), greatest(2, least(8, coalesce(p_max_players, 4))))
  returning id into new_id;
  perform public.loadout_join(new_id);
  return new_id;
end;
$$;

revoke execute on function public.escalation_create(text, int, text, text, int) from public, anon;
revoke execute on function public.loadout_create(text, text[], boolean, int) from public, anon;
grant execute on function public.escalation_create(text, int, text, text, int) to authenticated;
grant execute on function public.loadout_create(text, text[], boolean, int) to authenticated;

-- ---------- Regeln: alle Gewichte gleich ----------
update public.rules set weight = 1 where weight <> 1;
