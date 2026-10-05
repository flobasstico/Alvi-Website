-- Olympiade: Spiele-Liste → Glücksrad (gleiche Chancen, jedes Spiel nur einmal).
-- Gespielt wird extern; der Host markiert pro Spiel genau einen Sieger.
-- Punkte steigen: das 1. gedrehte Spiel bringt 1 Punkt, das 2. zwei Punkte usw.
-- Lobby mit Twitch-Login (mind. 2 Spieler). Runden ohne Admin werden beim Beenden gelöscht.

create table public.olympics (
  id bigint generated always as identity primary key,
  title text,
  host_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'laeuft', 'beendet')),
  max_players int not null default 8 check (max_players between 2 and 8),
  official boolean not null default false,
  current_game_id bigint,
  spun_at timestamptz,
  result text check (result in ('geschafft', 'gescheitert')),
  challenge_id bigint references public.challenges (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);
create index olympics_host_idx on public.olympics (host_id);
create index olympics_challenge_idx on public.olympics (challenge_id);

create table public.olympic_games (
  id bigint generated always as identity primary key,
  olympic_id bigint not null references public.olympics (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  position int,   -- Reihenfolge der Ziehung = Punkte; null = noch auf dem Rad
  winner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index olympic_games_olympic_idx on public.olympic_games (olympic_id);
create index olympic_games_winner_idx on public.olympic_games (winner_id);
alter table public.olympics
  add constraint olympics_current_game_fkey foreign key (current_game_id) references public.olympic_games (id) on delete set null;
create index olympics_current_game_idx on public.olympics (current_game_id);

create table public.olympic_players (
  olympic_id bigint not null references public.olympics (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text,
  avatar_url text,
  points int not null default 0,
  won boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (olympic_id, user_id)
);
create index olympic_players_user_idx on public.olympic_players (user_id);

alter table public.olympics enable row level security;
alter table public.olympic_games enable row level security;
alter table public.olympic_players enable row level security;
create policy "lesen" on public.olympics for select using (true);
create policy "lesen" on public.olympic_games for select using (true);
create policy "lesen" on public.olympic_players for select using (true);
-- Schreiben nur über die Funktionen unten

alter table public.challenges drop constraint challenges_source_check;
alter table public.challenges add constraint challenges_source_check
  check (source in ('rad', 'loadout', 'drop', 'bingo', 'auktion', 'eskalation', 'winchallenge', 'olympiade', 'manuell'));

-- Steuern darf der Host (und Admins)
create or replace function public.olympic_control(p_id bigint)
returns public.olympics
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.olympics;
begin
  select * into o from public.olympics where id = p_id for update;
  if o.id is null then raise exception 'Olympiade nicht gefunden'; end if;
  if o.host_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Nur wer die Olympiade eröffnet hat, darf sie steuern';
  end if;
  return o;
end;
$$;

-- Punkte neu berechnen: Summe der Positionen aller gewonnenen Spiele
create or replace function public.olympic_recalc(p_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.olympic_players p
     set points = coalesce((select sum(g.position) from public.olympic_games g
                             where g.olympic_id = p_id and g.winner_id = p.user_id and g.position is not null), 0)
   where p.olympic_id = p_id;
$$;

create or replace function public.olympic_join(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.olympics;
  prof public.profiles;
begin
  if auth.uid() is null then raise exception 'Bitte einloggen'; end if;
  select * into o from public.olympics where id = p_id for update;
  if o.id is null then raise exception 'Olympiade nicht gefunden'; end if;
  if o.status <> 'lobby' then raise exception 'Die Olympiade läuft schon – beitreten geht nur in der Lobby'; end if;
  if exists (select 1 from public.olympic_players where olympic_id = p_id and user_id = auth.uid()) then return; end if;
  if (select count(*) from public.olympic_players where olympic_id = p_id) >= o.max_players then
    raise exception 'Alle % Plätze sind belegt', o.max_players;
  end if;
  select * into prof from public.profiles where id = auth.uid();
  insert into public.olympic_players (olympic_id, user_id, display_name, avatar_url)
  values (p_id, auth.uid(), coalesce(prof.display_name, prof.twitch_login, 'Spieler'), prof.avatar_url);
  if not o.official and public.is_admin() then
    update public.olympics set official = true where id = p_id;
  end if;
end;
$$;

-- Ohne p_user: selbst austreten. Mit p_user: Host entfernt einen Mitspieler (nur in der Lobby)
create or replace function public.olympic_leave(p_id bigint, p_user uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.olympics;
begin
  select * into o from public.olympics where id = p_id;
  if o.status <> 'lobby' then raise exception 'Nur in der Lobby möglich'; end if;
  if p_user is null or p_user = auth.uid() then
    if o.host_id = auth.uid() then raise exception 'Der Host bleibt in der Olympiade'; end if;
    delete from public.olympic_players where olympic_id = p_id and user_id = auth.uid();
  elsif o.host_id = auth.uid() then
    delete from public.olympic_players where olympic_id = p_id and user_id = p_user;
  else
    raise exception 'Nur der Host kann Mitspieler entfernen';
  end if;
  update public.olympics oo set official = exists (
    select 1 from public.olympic_players p join public.profiles pr on pr.id = p.user_id
    where p.olympic_id = p_id and pr.role = 'admin'
  ) where oo.id = p_id;
end;
$$;

-- Olympiade eröffnen (jeder mit Login), Spiele als Liste
create or replace function public.olympic_create(p_title text, p_games text[], p_max_players int)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
  names text[];
begin
  if auth.uid() is null then raise exception 'Zum Spielen mit Twitch einloggen'; end if;
  select array_agg(n order by i) into names from (
    select distinct on (lower(left(trim(t), 60))) left(trim(t), 60) n, i
      from unnest(p_games) with ordinality u(t, i)
     where trim(t) <> ''
     order by lower(left(trim(t), 60)), i
  ) x;
  if coalesce(cardinality(names), 0) < 2 then raise exception 'Mindestens 2 Spiele eintragen'; end if;
  if cardinality(names) > 40 then raise exception 'Höchstens 40 Spiele'; end if;
  -- Aufräumen: nie beendete Olympiaden ohne Admin nach 2 Tagen
  delete from public.olympics where not official and status <> 'beendet' and created_at < now() - interval '2 days';
  insert into public.olympics (title, max_players, official)
  values (nullif(left(trim(coalesce(p_title, '')), 80), ''), greatest(2, least(8, coalesce(p_max_players, 8))), public.is_admin())
  returning id into new_id;
  insert into public.olympic_games (olympic_id, name) select new_id, n from unnest(names) n;
  perform public.olympic_join(new_id);
  return new_id;
end;
$$;

create or replace function public.olympic_add_game(p_id bigint, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.olympics := public.olympic_control(p_id);
  n text := left(trim(coalesce(p_name, '')), 60);
begin
  if o.status = 'beendet' then raise exception 'Die Olympiade ist beendet'; end if;
  if n = '' then raise exception 'Bitte einen Namen eingeben'; end if;
  if exists (select 1 from public.olympic_games where olympic_id = p_id and lower(name) = lower(n)) then
    raise exception 'Das Spiel ist schon dabei';
  end if;
  if (select count(*) from public.olympic_games where olympic_id = p_id) >= 40 then raise exception 'Höchstens 40 Spiele'; end if;
  insert into public.olympic_games (olympic_id, name) values (p_id, n);
end;
$$;

-- Nur Spiele, die noch auf dem Rad sind
create or replace function public.olympic_remove_game(p_game bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.olympic_games;
  o public.olympics;
begin
  select * into g from public.olympic_games where id = p_game;
  if g.id is null then raise exception 'Spiel nicht gefunden'; end if;
  o := public.olympic_control(g.olympic_id);
  if o.status = 'beendet' then raise exception 'Die Olympiade ist beendet'; end if;
  if g.position is not null then raise exception 'Bereits gezogene Spiele bleiben'; end if;
  delete from public.olympic_games where id = p_game;
end;
$$;

create or replace function public.olympic_start(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.olympics := public.olympic_control(p_id);
begin
  if o.status <> 'lobby' then raise exception 'Die Olympiade läuft schon'; end if;
  if (select count(*) from public.olympic_players where olympic_id = p_id) < 2 then
    raise exception 'Mindestens 2 Spieler nötig';
  end if;
  if (select count(*) from public.olympic_games where olympic_id = p_id) < 2 then
    raise exception 'Mindestens 2 Spiele nötig';
  end if;
  update public.olympics set status = 'laeuft', started_at = now() where id = p_id;
end;
$$;

-- Rad drehen: zufälliges Spiel (gleiche Chancen) vom Rad nehmen. Erst wenn das aktuelle Spiel einen Sieger hat.
create or replace function public.olympic_spin(p_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.olympics := public.olympic_control(p_id);
  pick bigint;
  pos int;
begin
  if o.status <> 'laeuft' then raise exception 'Die Olympiade läuft nicht'; end if;
  if o.current_game_id is not null
     and exists (select 1 from public.olympic_games where id = o.current_game_id and winner_id is null) then
    raise exception 'Erst den Sieger des aktuellen Spiels markieren';
  end if;
  select id into pick from public.olympic_games where olympic_id = p_id and position is null order by random() limit 1;
  if pick is null then raise exception 'Alle Spiele sind gespielt'; end if;
  select coalesce(max(position), 0) + 1 into pos from public.olympic_games where olympic_id = p_id;
  update public.olympic_games set position = pos where id = pick;
  update public.olympics set current_game_id = pick, spun_at = now() where id = p_id;
  return pick;
end;
$$;

-- Sieger eines gezogenen Spiels markieren (auch korrigieren), genau ein Spieler
create or replace function public.olympic_decide(p_game bigint, p_winner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.olympic_games;
  o public.olympics;
begin
  select * into g from public.olympic_games where id = p_game;
  if g.id is null then raise exception 'Spiel nicht gefunden'; end if;
  o := public.olympic_control(g.olympic_id);
  if o.status <> 'laeuft' then raise exception 'Die Olympiade läuft nicht'; end if;
  if g.position is null then raise exception 'Das Spiel wurde noch nicht gedreht'; end if;
  if not exists (select 1 from public.olympic_players where olympic_id = g.olympic_id and user_id = p_winner) then
    raise exception 'Der Sieger muss mitspielen';
  end if;
  update public.olympic_games set winner_id = p_winner where id = p_game;
  perform public.olympic_recalc(g.olympic_id);
end;
$$;

-- Beenden: höchste Punktzahl gewinnt (Gleichstand: alle). Ohne Admin → löschen.
-- Spielt Alvi mit: Stats-Eintrag, geschafft wenn Alvi (mit-)gewinnt.
create or replace function public.olympic_finish(p_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.olympics := public.olympic_control(p_id);
  best int;
  creator public.olympic_players;
  res text;
  ch bigint;
begin
  if o.status = 'beendet' then return coalesce(o.result, 'beendet'); end if;
  if not o.official then
    delete from public.olympics where id = p_id;
    return 'geloescht';
  end if;

  perform public.olympic_recalc(p_id);
  select max(points) into best from public.olympic_players where olympic_id = p_id;
  update public.olympic_players set won = (best > 0 and points = best) where olympic_id = p_id;

  select * into creator from public.olympic_players where olympic_id = p_id and public.is_main_creator(user_id) limit 1;
  if creator.user_id is not null then
    res := case when creator.won then 'geschafft' else 'gescheitert' end;
    insert into public.challenges (title, source, status, played_at, config)
    values (
      'Olympiade' || coalesce(': ' || o.title, '') || ' – ' || coalesce(
        (select string_agg(display_name, ' & ' order by display_name) from public.olympic_players where olympic_id = p_id and won), 'ohne Sieger'
      ) || ' gewinnt',
      'olympiade', res, coalesce(o.started_at, now()),
      jsonb_build_object(
        'olympic_id', o.id, 'points', creator.points,
        'games', (select coalesce(jsonb_agg(jsonb_build_object('name', g.name, 'position', g.position, 'winner', p.display_name) order by g.position), '[]'::jsonb)
                  from public.olympic_games g left join public.olympic_players p on p.olympic_id = g.olympic_id and p.user_id = g.winner_id
                  where g.olympic_id = p_id and g.position is not null),
        'players', (select coalesce(jsonb_agg(jsonb_build_object('name', display_name, 'points', points, 'won', won) order by points desc), '[]'::jsonb)
                    from public.olympic_players where olympic_id = p_id)
      )
    )
    returning id into ch;
  end if;

  update public.olympics set status = 'beendet', ended_at = now(), result = res, challenge_id = ch where id = p_id;
  return coalesce(res, 'beendet');
end;
$$;

revoke execute on function public.olympic_control(bigint) from public, anon, authenticated;
revoke execute on function public.olympic_recalc(bigint) from public, anon, authenticated;
revoke execute on function public.olympic_join(bigint) from public, anon;
revoke execute on function public.olympic_leave(bigint, uuid) from public, anon;
revoke execute on function public.olympic_create(text, text[], int) from public, anon;
revoke execute on function public.olympic_add_game(bigint, text) from public, anon;
revoke execute on function public.olympic_remove_game(bigint) from public, anon;
revoke execute on function public.olympic_start(bigint) from public, anon;
revoke execute on function public.olympic_spin(bigint) from public, anon;
revoke execute on function public.olympic_decide(bigint, uuid) from public, anon;
revoke execute on function public.olympic_finish(bigint) from public, anon;
grant execute on function public.olympic_join(bigint) to authenticated;
grant execute on function public.olympic_leave(bigint, uuid) to authenticated;
grant execute on function public.olympic_create(text, text[], int) to authenticated;
grant execute on function public.olympic_add_game(bigint, text) to authenticated;
grant execute on function public.olympic_remove_game(bigint) to authenticated;
grant execute on function public.olympic_start(bigint) to authenticated;
grant execute on function public.olympic_spin(bigint) to authenticated;
grant execute on function public.olympic_decide(bigint, uuid) to authenticated;
grant execute on function public.olympic_finish(bigint) to authenticated;

-- Admins löschen auch Olympiaden (samt Stats-Eintrag)
create or replace function public.admin_delete_round(p_kind text, p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch bigint;
begin
  if not public.is_admin() then raise exception 'Nur Admins löschen Runden'; end if;
  if p_kind = 'eskalation' then
    delete from public.escalation_sessions where id = p_id returning challenge_id into ch;
  elsif p_kind = 'loadout' then
    delete from public.loadout_sessions where id = p_id returning challenge_id into ch;
  elsif p_kind = 'auktion' then
    delete from public.auctions where id = p_id returning challenge_id into ch;
  elsif p_kind = 'bingo' then
    delete from public.bingo_rounds where id = p_id returning challenge_id into ch;
  elsif p_kind = 'winchallenge' then
    delete from public.win_challenges where id = p_id returning challenge_id into ch;
  elsif p_kind = 'olympiade' then
    delete from public.olympics where id = p_id returning challenge_id into ch;
  elsif p_kind = 'challenge' then
    ch := p_id;
    delete from public.escalation_sessions where challenge_id = ch;
    delete from public.loadout_sessions where challenge_id = ch;
    delete from public.auctions where challenge_id = ch;
    delete from public.bingo_rounds where challenge_id = ch;
    delete from public.win_challenges where challenge_id = ch;
    delete from public.olympics where challenge_id = ch;
  else
    raise exception 'Unbekannte Spielart';
  end if;
  if ch is not null then
    delete from public.challenges where id = ch;
  end if;
end;
$$;

alter publication supabase_realtime add table public.olympics, public.olympic_games, public.olympic_players;
