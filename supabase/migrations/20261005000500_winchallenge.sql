-- Winchallenge: Liste von Spielen mit Ziel-Siegen, gemeinsamer Countdown-Timer, OBS-Overlay.
-- Steuerung durch Admins; Zeitpunkte setzt die Datenbank (now()), damit alle Bildschirme synchron sind.

create table public.win_challenges (
  id bigint generated always as identity primary key,
  title text,
  host_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  duration_s int not null default 3600 check (duration_s between 0 and 86400),   -- 0 = ohne Zeitlimit
  status text not null default 'bereit' check (status in ('bereit', 'laeuft', 'pausiert', 'beendet')),
  started_at timestamptz,          -- Beginn des aktuellen Laufabschnitts (nur bei 'laeuft')
  elapsed_s numeric not null default 0,   -- abgelaufene Zeit vor dem aktuellen Abschnitt
  result text check (result in ('geschafft', 'gescheitert')),
  challenge_id bigint references public.challenges (id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index win_challenges_host_idx on public.win_challenges (host_id);
create index win_challenges_challenge_idx on public.win_challenges (challenge_id);

create table public.win_challenge_games (
  id bigint generated always as identity primary key,
  challenge_id bigint not null references public.win_challenges (id) on delete cascade,
  position int not null default 0,
  name text not null check (char_length(name) between 1 and 60),
  target int not null default 1 check (target between 1 and 999),
  wins int not null default 0 check (wins between 0 and 999)
);
create index win_challenge_games_challenge_idx on public.win_challenge_games (challenge_id);

alter table public.win_challenges enable row level security;
alter table public.win_challenge_games enable row level security;
create policy "lesen" on public.win_challenges for select using (true);
create policy "lesen" on public.win_challenge_games for select using (true);
create policy "admin insert" on public.win_challenges for insert to authenticated with check ((select public.is_admin()));
create policy "admin delete" on public.win_challenges for delete to authenticated using ((select public.is_admin()));
create policy "admin insert" on public.win_challenge_games for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.win_challenge_games for update to authenticated using ((select public.is_admin()));
create policy "admin delete" on public.win_challenge_games for delete to authenticated using ((select public.is_admin()));

-- Challenge-Quelle ergänzen
alter table public.challenges drop constraint challenges_source_check;
alter table public.challenges add constraint challenges_source_check
  check (source in ('rad', 'loadout', 'drop', 'bingo', 'auktion', 'eskalation', 'winchallenge', 'manuell'));

-- Timer steuern: start (auch Fortsetzen), pause, reset
create or replace function public.win_timer(p_id bigint, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.win_challenges;
begin
  if not public.is_admin() then raise exception 'Nur Admins steuern die Winchallenge'; end if;
  select * into w from public.win_challenges where id = p_id for update;
  if w.id is null then raise exception 'Winchallenge nicht gefunden'; end if;
  if w.status = 'beendet' then raise exception 'Die Winchallenge ist beendet'; end if;
  if p_action = 'start' then
    if w.status <> 'laeuft' then
      update public.win_challenges set status = 'laeuft', started_at = now() where id = p_id;
    end if;
  elsif p_action = 'pause' then
    if w.status = 'laeuft' then
      update public.win_challenges
         set status = 'pausiert', elapsed_s = elapsed_s + extract(epoch from now() - started_at), started_at = null
       where id = p_id;
    end if;
  elsif p_action = 'reset' then
    update public.win_challenges set status = 'bereit', elapsed_s = 0, started_at = null where id = p_id;
  else
    raise exception 'Unbekannte Aktion';
  end if;
end;
$$;

-- Sieg zählen (+1) oder korrigieren (-1)
create or replace function public.win_add(p_game bigint, p_delta int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  if not public.is_admin() then raise exception 'Nur Admins zählen Siege'; end if;
  if exists (
    select 1 from public.win_challenge_games g join public.win_challenges w on w.id = g.challenge_id
    where g.id = p_game and w.status = 'beendet'
  ) then
    raise exception 'Die Winchallenge ist beendet';
  end if;
  update public.win_challenge_games
     set wins = greatest(0, least(999, wins + coalesce(p_delta, 0)))
   where id = p_game
  returning wins into n;
  return n;
end;
$$;

-- Beenden und werten (idempotent): geschafft, wenn jedes Spiel sein Ziel erreicht hat
create or replace function public.win_finish(p_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.win_challenges;
  res text;
  ch bigint;
  games jsonb;
  used numeric;
begin
  if not public.is_admin() then raise exception 'Nur Admins beenden die Winchallenge'; end if;
  select * into w from public.win_challenges where id = p_id for update;
  if w.id is null then raise exception 'Winchallenge nicht gefunden'; end if;
  if w.status = 'beendet' then return w.result; end if;

  used := w.elapsed_s + case when w.status = 'laeuft' then extract(epoch from now() - w.started_at) else 0 end;
  if w.duration_s > 0 then used := least(used, w.duration_s); end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'wins', wins, 'target', target) order by position, id), '[]'::jsonb)
    into games from public.win_challenge_games where challenge_id = p_id;
  res := case
    when jsonb_array_length(games) > 0
     and not exists (select 1 from public.win_challenge_games where challenge_id = p_id and wins < target)
    then 'geschafft' else 'gescheitert' end;

  insert into public.challenges (title, source, status, played_at, config)
  values (
    'Winchallenge' || coalesce(': ' || w.title, ''), 'winchallenge', res, coalesce(w.created_at, now()),
    jsonb_build_object('win_challenge_id', w.id, 'games', games, 'duration_s', w.duration_s, 'used_s', round(used))
  )
  returning id into ch;

  update public.win_challenges
     set status = 'beendet', result = res, challenge_id = ch, ended_at = now(), elapsed_s = used, started_at = null
   where id = p_id;
  return res;
end;
$$;

revoke execute on function public.win_timer(bigint, text) from public, anon;
revoke execute on function public.win_add(bigint, int) from public, anon;
revoke execute on function public.win_finish(bigint) from public, anon;
grant execute on function public.win_timer(bigint, text) to authenticated;
grant execute on function public.win_add(bigint, int) to authenticated;
grant execute on function public.win_finish(bigint) to authenticated;

alter publication supabase_realtime add table public.win_challenges, public.win_challenge_games;
