-- Minispiele (Drop-Zone, Sturm-Lauf): Highscores mit Twitch-Login.
--
-- Schutz gegen gefälschte Punkte (Browser-Spiele lassen sich nie ganz absichern, das reicht für eine Fan-Seite):
--  * Jede Runde wird vorher beim Server gestartet (Startzeit kommt vom Server).
--  * Beim Einreichen: Mindestdauer, Höchstpunktzahl abhängig von der Spielzeit, nur einmal pro Runde.
--  * Höchstens 40 Runden pro 10 Minuten und Person.
--  * Admins können Einträge löschen.
-- Bestenlisten nur über Funktionen: private Profile tauchen dort nicht auf.

create table public.minigame_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  game text not null check (game in ('dropzone', 'sturmlauf')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score int check (score >= 0)
);
create index minigame_runs_board_idx on public.minigame_runs (game, score desc) where score is not null;
create index minigame_runs_user_idx on public.minigame_runs (user_id, started_at);

alter table public.minigame_runs enable row level security;
-- Eigene Runden lesen, Admins alles; Löschen nur Admins. Schreiben nur über die Funktionen.
create policy "eigene Runden" on public.minigame_runs for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Admins löschen" on public.minigame_runs for delete to authenticated using (public.is_admin());
grant select, delete on public.minigame_runs to authenticated;

-- Runde starten → Runden-ID
create or replace function public.minigame_start(p_game text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if auth.uid() is null then raise exception 'Zum Speichern mit Twitch einloggen'; end if;
  if p_game not in ('dropzone', 'sturmlauf') then raise exception 'Unbekanntes Spiel'; end if;
  if (select count(*) from public.minigame_runs where user_id = auth.uid() and started_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Kurze Pause – zu viele Runden in kurzer Zeit';
  end if;
  -- nie eingereichte Runden aufräumen
  delete from public.minigame_runs where user_id = auth.uid() and score is null and started_at < now() - interval '1 day';
  insert into public.minigame_runs (user_id, game) values (auth.uid(), p_game) returning id into new_id;
  return new_id;
end;
$$;

-- Ergebnis einreichen → true, wenn neuer persönlicher Rekord
create or replace function public.minigame_submit(p_run bigint, p_score int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.minigame_runs;
  secs numeric;
  best int;
begin
  select * into r from public.minigame_runs where id = p_run for update;
  if r.id is null or r.user_id is distinct from auth.uid() then raise exception 'Runde nicht gefunden'; end if;
  if r.score is not null then raise exception 'Diese Runde ist schon gewertet'; end if;
  if p_score is null or p_score < 0 then raise exception 'Ungültige Punktzahl'; end if;
  secs := extract(epoch from now() - r.started_at);
  if secs > 3600 then raise exception 'Die Runde ist abgelaufen'; end if;
  if r.game = 'dropzone' then
    -- 3 Sprünge à mind. ~3 s, höchstens 150 Punkte pro Sprung
    if secs < 8 or p_score > 450 then raise exception 'Ergebnis nicht plausibel'; end if;
  else
    -- Sturm-Lauf: höchstens ~100 Punkte pro Sekunde
    if secs < 2 or p_score > secs * 100 + 50 then raise exception 'Ergebnis nicht plausibel'; end if;
  end if;
  select max(score) into best from public.minigame_runs where user_id = r.user_id and game = r.game and score is not null;
  update public.minigame_runs set score = p_score, finished_at = now() where id = p_run;
  return best is null or p_score > best;
end;
$$;

-- Bestenliste: beste Runde je Person; Zeitraum heute / woche / ewig (Berliner Zeit)
create or replace function public.minigame_board(p_game text, p_period text default 'ewig', p_limit int default 50)
returns table (run_id bigint, user_id uuid, name text, login text, avatar text, score int, achieved_at timestamptz, is_alvi boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.user_id, b.name, b.login, b.avatar, b.score, b.finished_at, public.is_main_creator(b.user_id)
  from (
    select distinct on (r.user_id) r.id, r.user_id, coalesce(p.display_name, p.twitch_login) as name, p.twitch_login as login,
           p.avatar_url as avatar, r.score, r.finished_at
      from public.minigame_runs r
      join public.profiles p on p.id = r.user_id
     where r.game = p_game and r.score is not null and p.is_public and not p.banned
       and r.finished_at >= case p_period
             when 'heute' then date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin'
             when 'woche' then date_trunc('week', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin'
             else '-infinity'::timestamptz
           end
     order by r.user_id, r.score desc, r.finished_at
  ) b
  order by b.score desc, b.finished_at
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

-- Alvis Bestwert je Spiel (für „Schlag Alvi“), auch wenn er nicht in den Top 50 steht
create or replace function public.minigame_alvi_best(p_game text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select max(r.score) from public.minigame_runs r where r.game = p_game and r.score is not null and public.is_main_creator(r.user_id);
$$;

-- Werte einer Person fürs Profil (leer bei privatem Profil, außer man ist es selbst)
create or replace function public.minigame_profile(p_user uuid)
returns table (game text, best int, plays int, rank_alltime int, top_week boolean, beat_alvi boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select r.game, max(r.score) as best, count(*)::int as plays
      from public.minigame_runs r
     where r.user_id = p_user and r.score is not null
       and exists (select 1 from public.profiles p where p.id = p_user and (p.is_public or p.id = auth.uid()))
     group by r.game
  )
  select me.game, me.best, me.plays,
         (select count(distinct r.user_id)::int + 1 from public.minigame_runs r join public.profiles p on p.id = r.user_id
           where r.game = me.game and r.score > me.best and p.is_public and not p.banned),
         exists (select 1 from public.minigame_board(me.game, 'woche', 10) w where w.user_id = p_user),
         me.best > coalesce(public.minigame_alvi_best(me.game), 2147483647) and not public.is_main_creator(p_user)
    from me;
$$;

revoke execute on function public.minigame_start(text) from public, anon;
revoke execute on function public.minigame_submit(bigint, int) from public, anon;
grant execute on function public.minigame_start(text) to authenticated;
grant execute on function public.minigame_submit(bigint, int) to authenticated;
grant execute on function public.minigame_board(text, text, int) to anon, authenticated;
grant execute on function public.minigame_alvi_best(text) to anon, authenticated;
grant execute on function public.minigame_profile(uuid) to anon, authenticated;
