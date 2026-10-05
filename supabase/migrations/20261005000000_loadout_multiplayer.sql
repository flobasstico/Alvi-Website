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
