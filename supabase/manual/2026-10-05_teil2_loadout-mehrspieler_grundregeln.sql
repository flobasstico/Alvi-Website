-- ============================================================================
-- Live-Datenbank nachziehen, Teil 2 (einmalig im Supabase SQL-Editor ausführen)
-- Komplett kopieren → im SQL-Editor des Projekts „Alvi“ einfügen → Run.
-- Enthält:
--   1. Loadout-Würfel: Mehrspieler-Modus (20261005000000_loadout_multiplayer.sql)
--   2. Regel-Eskalation: getrennte Pools für Grund- und Zusatzregeln (20261005000100_escalation_base_rules.sql)
-- Legt nur Neues an bzw. erweitert Funktionen, löscht nichts. Läuft komplett oder gar nicht (Transaktion).
-- ============================================================================
begin;

-- Loadout-Würfel mit mehreren Spielern: Ein Admin eröffnet eine Runde, Mitspieler treten per Login bei
-- und würfeln am eigenen Gerät ihr eigenes Loadout (sperren/neu würfeln wie solo). Mit „Start“ sind
-- alle Loadouts fest; der Host beendet die Runde und wählt den Sieger (Stats wie bei der Regel-Eskalation).

create table public.loadout_sessions (
  id bigint generated always as identity primary key,
  title text,
  host_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  season_id bigint references public.seasons (id) on delete set null,
  slots int not null default 5 check (slots between 1 and 10),
  rarities text[] not null,
  must_heal boolean not null default true,
  status text not null default 'offen' check (status in ('offen', 'laeuft', 'beendet')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  result text check (result in ('geschafft', 'gescheitert')),
  challenge_id bigint references public.challenges (id) on delete set null,
  winner_id uuid references public.profiles (id) on delete set null,
  winner_name text
);
create index loadout_sessions_host_idx on public.loadout_sessions (host_id);
create index loadout_sessions_winner_idx on public.loadout_sessions (winner_id);
create index loadout_sessions_season_idx on public.loadout_sessions (season_id);
create index loadout_sessions_challenge_idx on public.loadout_sessions (challenge_id);

create table public.loadout_players (
  session_id bigint not null references public.loadout_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text,
  avatar_url text,
  item_ids bigint[] not null default '{}',   -- ein Eintrag pro Slot, null = leer
  rolled_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index loadout_players_user_idx on public.loadout_players (user_id);

alter table public.loadout_sessions enable row level security;
alter table public.loadout_players enable row level security;
create policy "lesen" on public.loadout_sessions for select using (true);
create policy "lesen" on public.loadout_players for select using (true);

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
  select * into s from public.loadout_sessions where id = p_session;
  if s.id is null then raise exception 'Runde nicht gefunden'; end if;
  if s.status <> 'offen' then raise exception 'Die Runde läuft schon – beitreten geht nur vor dem Start'; end if;
  select * into prof from public.profiles where id = auth.uid();
  insert into public.loadout_players (session_id, user_id, display_name, avatar_url)
  values (p_session, auth.uid(), coalesce(prof.display_name, prof.twitch_login, 'Spieler'), prof.avatar_url)
  on conflict do nothing;
end;
$$;

-- Ohne p_user: selbst austreten. Mit p_user: Host entfernt einen Mitspieler.
create or replace function public.loadout_leave(p_session bigint, p_user uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.loadout_sessions;
begin
  select * into s from public.loadout_sessions where id = p_session;
  if s.status = 'beendet' then raise exception 'Die Runde ist schon beendet'; end if;
  if p_user is null or p_user = auth.uid() then
    if s.host_id = auth.uid() then raise exception 'Der Host bleibt in der Runde'; end if;
    delete from public.loadout_players where session_id = p_session and user_id = auth.uid();
  elsif s.host_id = auth.uid() then
    delete from public.loadout_players where session_id = p_session and user_id = p_user;
  else
    raise exception 'Nur der Host kann Mitspieler entfernen';
  end if;
end;
$$;

create or replace function public.loadout_create(p_title text, p_rarities text[], p_must_heal boolean)
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
  insert into public.loadout_sessions (title, season_id, rarities, must_heal)
  values (nullif(trim(p_title), ''), season, rar, coalesce(p_must_heal, true))
  returning id into new_id;
  perform public.loadout_join(new_id);
  return new_id;
end;
$$;

-- Eigenes Loadout speichern (nur vor dem Start). Geprüft wird gegen den Pool der Runde:
-- Season, aktiv, erlaubte Seltenheit, jedes Item (Name) höchstens einmal.
create or replace function public.loadout_set_items(p_session bigint, p_items bigint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.loadout_sessions;
  ids bigint[];
  bad int;
begin
  select * into s from public.loadout_sessions where id = p_session;
  if s.id is null then raise exception 'Runde nicht gefunden'; end if;
  if s.status <> 'offen' then raise exception 'Die Loadouts sind schon fest'; end if;
  if not exists (select 1 from public.loadout_players where session_id = p_session and user_id = auth.uid()) then
    raise exception 'Zuerst der Runde beitreten';
  end if;
  if cardinality(p_items) <> s.slots then raise exception 'Ungültige Anzahl Slots'; end if;
  select array_agg(x) into ids from unnest(p_items) x where x is not null;
  ids := coalesce(ids, '{}');

  select count(*) into bad
  from unnest(ids) x
  left join public.loot_items li
    on li.id = x and li.active and li.season_id = s.season_id and li.rarity = any (s.rarities)
  where li.id is null;
  if bad > 0 then raise exception 'Item nicht im Pool dieser Runde'; end if;

  if (select count(distinct lower(li.name)) from public.loot_items li where li.id = any (ids)) <> cardinality(ids) then
    raise exception 'Jedes Item darf nur einmal im Loadout sein';
  end if;

  update public.loadout_players set item_ids = p_items, rolled_at = now()
   where session_id = p_session and user_id = auth.uid();
end;
$$;

create or replace function public.loadout_start(p_session bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.loadout_sessions;
begin
  select * into s from public.loadout_sessions where id = p_session for update;
  if s.host_id is distinct from auth.uid() then raise exception 'Nur wer die Runde eröffnet hat, darf starten'; end if;
  if s.status <> 'offen' then raise exception 'Die Runde läuft schon'; end if;
  update public.loadout_sessions set status = 'laeuft', started_at = now() where id = p_session;
end;
$$;

-- Runde beenden. p_winner = Sieger (muss Mitspieler sein) oder null = ohne Wertung.
create or replace function public.loadout_finish(p_session bigint, p_winner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.loadout_sessions;
  w public.loadout_players;
  ch bigint;
  res text;
  loadouts jsonb;
begin
  select * into s from public.loadout_sessions where id = p_session for update;
  if s.id is null then raise exception 'Runde nicht gefunden'; end if;
  if s.host_id is distinct from auth.uid() then raise exception 'Nur wer die Runde eröffnet hat, darf sie beenden'; end if;
  if s.status = 'beendet' then raise exception 'Die Runde ist schon beendet'; end if;

  if p_winner is not null then
    select * into w from public.loadout_players where session_id = p_session and user_id = p_winner;
    if w.user_id is null then raise exception 'Der Sieger muss Mitspieler der Runde sein'; end if;
    res := case when public.is_main_creator(p_winner) then 'geschafft' else 'gescheitert' end;

    -- Loadouts als Text festhalten (Name + Seltenheit), unabhängig von späteren Pool-Änderungen
    select coalesce(jsonb_agg(jsonb_build_object(
             'player', p.display_name,
             'items', (select coalesce(jsonb_agg(jsonb_build_object('name', li.name, 'rarity', li.rarity, 'type', li.type) order by o.n), '[]'::jsonb)
                       from unnest(p.item_ids) with ordinality o(item_id, n)
                       join public.loot_items li on li.id = o.item_id)
           ) order by p.joined_at), '[]'::jsonb)
      into loadouts
      from public.loadout_players p where p.session_id = p_session;

    insert into public.challenges (title, source, status, played_at, config)
    values (
      'Loadout-Würfel' || coalesce(': ' || s.title, '') || ' – ' || w.display_name || ' gewinnt',
      'loadout', res, coalesce(s.started_at, now()),
      jsonb_build_object('session_id', s.id, 'winner', w.display_name, 'loadouts', loadouts)
    )
    returning id into ch;
  end if;

  update public.loadout_sessions
     set status = 'beendet', ended_at = now(), result = res, challenge_id = ch,
         winner_id = p_winner, winner_name = w.display_name
   where id = p_session;
end;
$$;

-- Bestenliste: Siege pro Spieler
create view public.loadout_leaderboard
with (security_invoker = true) as
select s.winner_id, max(s.winner_name) as name, count(*)::int as wins, max(s.ended_at) as last_win
from public.loadout_sessions s
where s.winner_id is not null
group by s.winner_id;

revoke execute on function public.loadout_join(bigint) from public, anon;
revoke execute on function public.loadout_leave(bigint, uuid) from public, anon;
revoke execute on function public.loadout_create(text, text[], boolean) from public, anon;
revoke execute on function public.loadout_set_items(bigint, bigint[]) from public, anon;
revoke execute on function public.loadout_start(bigint) from public, anon;
revoke execute on function public.loadout_finish(bigint, uuid) from public, anon;
grant execute on function public.loadout_join(bigint) to authenticated;
grant execute on function public.loadout_leave(bigint, uuid) to authenticated;
grant execute on function public.loadout_create(text, text[], boolean) to authenticated;
grant execute on function public.loadout_set_items(bigint, bigint[]) to authenticated;
grant execute on function public.loadout_start(bigint) to authenticated;
grant execute on function public.loadout_finish(bigint, uuid) to authenticated;

alter publication supabase_realtime add table public.loadout_sessions, public.loadout_players;

-- Regel-Eskalation: getrennte Pools für Grundregeln (Glücksrad zum Start) und Zusatzregeln (alle X Minuten).
-- Bestehende Regeln werden Zusatzregeln.

alter table public.escalation_rules
  add column kind text not null default 'zusatz' check (kind in ('grund', 'zusatz'));

-- Zufällige, in dieser Runde noch nicht gezogene Zusatzregel
create or replace function public.escalation_pick_rule(p_session bigint)
returns public.escalation_rules
language sql
volatile
security definer
set search_path = ''
as $$
  select r.*
  from public.escalation_rules r
  where r.active
    and r.kind = 'zusatz'
    and r.id not in (
      select sr.rule_id from public.escalation_session_rules sr
      where sr.session_id = p_session and sr.rule_id is not null
    )
  order by random()
  limit 1;
$$;

-- Grundregel per Glücksrad aus dem Grundregel-Pool (nur Host, nur einmal)
create or replace function public.escalation_draw_base(p_session bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.escalation_sessions;
  r public.escalation_rules;
begin
  select * into s from public.escalation_sessions where id = p_session for update;
  if s.id is null then raise exception 'Runde nicht gefunden'; end if;
  if s.host_id is distinct from auth.uid() then raise exception 'Nur wer die Runde eröffnet hat, darf drehen'; end if;
  if exists (select 1 from public.escalation_session_rules where session_id = p_session) then
    raise exception 'Die Grundregel steht schon fest';
  end if;
  select * into r from public.escalation_rules where active and kind = 'grund' order by random() limit 1;
  if r.id is null then raise exception 'Der Grundregel-Pool ist leer'; end if;
  insert into public.escalation_session_rules (session_id, position, rule_id, text) values (p_session, 1, r.id, r.text);
  return r.id;
end;
$$;

-- Abstimmungs-Optionen nur aus den Zusatzregeln
create or replace function public.escalation_open_poll(p_session bigint, p_position int, p_opens timestamptz, p_closes timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  opts jsonb;
begin
  select jsonb_agg(jsonb_build_object('rule_id', x.id, 'text', x.text)) into opts
  from (
    select r.id, r.text from public.escalation_rules r
    where r.active
      and r.kind = 'zusatz'
      and r.id not in (
        select sr.rule_id from public.escalation_session_rules sr
        where sr.session_id = p_session and sr.rule_id is not null
      )
    order by random()
    limit 3
  ) x;
  if opts is null then
    update public.escalation_sessions set pool_exhausted = true where id = p_session and not pool_exhausted;
    return false;
  end if;
  insert into public.escalation_polls (session_id, position, options, opens_at, closes_at)
  values (p_session, p_position, opts, p_opens, p_closes)
  on conflict (session_id, position) do nothing;
  return true;
end;
$$;

-- Eröffnen: beide Pools brauchen mindestens eine aktive Regel
create or replace function public.escalation_create(p_title text, p_interval_s int, p_mode text, p_channel text)
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
  insert into public.escalation_sessions (title, interval_s, mode, twitch_channel)
  values (nullif(trim(p_title), ''), greatest(30, least(3600, coalesce(p_interval_s, 240))), p_mode, chan)
  returning id into new_id;
  perform public.escalation_join(new_id);
  return new_id;
end;
$$;

commit;
