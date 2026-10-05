-- Bingo als Mehrspieler-Spiel: Karten (3×3, eigene Aufgaben) erstellt jeder mit Twitch-Login;
-- eine Runde spielt eine Karte, jeder Mitspieler hakt seine eigenen Felder ab.
-- Punkte: 1 pro Feld, +3 pro Bingo (Reihe/Spalte/Diagonale). Sieg: höchste Punktzahl.
-- Runden ohne Admin werden beim Beenden gelöscht (wie Nachspiel-Runden).
-- Die alten Tabellen (bingo_games/bingo_cards/bingo_marks) bleiben vorerst bestehen, werden aber nicht mehr benutzt.

create table public.bingo_card_templates (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 60),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  author_name text,
  tasks text[] not null check (cardinality(tasks) = 9),
  created_at timestamptz not null default now()
);
create index bingo_card_templates_author_idx on public.bingo_card_templates (author_id);

create table public.bingo_rounds (
  id bigint generated always as identity primary key,
  title text,
  host_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  template_id bigint references public.bingo_card_templates (id) on delete set null,
  tasks text[] not null check (cardinality(tasks) = 9),
  status text not null default 'lobby' check (status in ('lobby', 'laeuft', 'beendet')),
  max_players int not null default 4 check (max_players between 2 and 8),
  official boolean not null default false,
  result text check (result in ('geschafft', 'gescheitert')),
  challenge_id bigint references public.challenges (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);
create index bingo_rounds_host_idx on public.bingo_rounds (host_id);
create index bingo_rounds_template_idx on public.bingo_rounds (template_id);
create index bingo_rounds_challenge_idx on public.bingo_rounds (challenge_id);

create table public.bingo_round_players (
  round_id bigint not null references public.bingo_rounds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text,
  avatar_url text,
  marks boolean[] not null default array_fill(false, array[9]),
  points int,
  won boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (round_id, user_id)
);
create index bingo_round_players_user_idx on public.bingo_round_players (user_id);

alter table public.bingo_card_templates enable row level security;
alter table public.bingo_rounds enable row level security;
alter table public.bingo_round_players enable row level security;
create policy "lesen" on public.bingo_card_templates for select using (true);
create policy "lesen" on public.bingo_rounds for select using (true);
create policy "lesen" on public.bingo_round_players for select using (true);
-- Eigene Karten löschen (Admins alle); Anlegen nur über bingo_card_create
create policy "eigene loeschen" on public.bingo_card_templates for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()));

-- Punkte einer Karte: 1 pro Feld, +3 pro voller Linie
create or replace function public.bingo_points(p_marks boolean[])
returns int
language sql
immutable
set search_path = ''
as $$
  select (select count(*) from unnest(p_marks) m where m)::int
       + 3 * (select count(*) from (values
           (array[1,2,3]), (array[4,5,6]), (array[7,8,9]),
           (array[1,4,7]), (array[2,5,8]), (array[3,6,9]),
           (array[1,5,9]), (array[3,5,7])
         ) l(idx)
         where coalesce(p_marks[idx[1]], false) and coalesce(p_marks[idx[2]], false) and coalesce(p_marks[idx[3]], false))::int;
$$;

-- Karte erstellen (9 Aufgaben, mit Twitch-Namen gespeichert)
create or replace function public.bingo_card_create(p_title text, p_tasks text[])
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text[];
  prof public.profiles;
  new_id bigint;
begin
  if auth.uid() is null then raise exception 'Zum Erstellen mit Twitch einloggen'; end if;
  select array_agg(left(trim(t), 80) order by n) into cleaned from unnest(p_tasks) with ordinality u(t, n);
  if coalesce(cardinality(cleaned), 0) <> 9 or exists (select 1 from unnest(cleaned) t where t = '') then
    raise exception 'Bitte alle 9 Felder ausfüllen';
  end if;
  if (select count(distinct lower(t)) from unnest(cleaned) t) <> 9 then raise exception 'Jede Aufgabe nur einmal'; end if;
  if nullif(trim(p_title), '') is null then raise exception 'Bitte einen Namen für die Karte eingeben'; end if;
  select * into prof from public.profiles where id = auth.uid();
  insert into public.bingo_card_templates (title, author_name, tasks)
  values (left(trim(p_title), 60), coalesce(prof.display_name, prof.twitch_login), cleaned)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.bingo_join(p_round bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.bingo_rounds;
  prof public.profiles;
begin
  if auth.uid() is null then raise exception 'Bitte einloggen'; end if;
  select * into r from public.bingo_rounds where id = p_round for update;
  if r.id is null then raise exception 'Runde nicht gefunden'; end if;
  if r.status <> 'lobby' then raise exception 'Die Runde läuft schon – beitreten geht nur in der Lobby'; end if;
  if exists (select 1 from public.bingo_round_players where round_id = p_round and user_id = auth.uid()) then return; end if;
  if (select count(*) from public.bingo_round_players where round_id = p_round) >= r.max_players then
    raise exception 'Alle % Plätze sind belegt', r.max_players;
  end if;
  select * into prof from public.profiles where id = auth.uid();
  insert into public.bingo_round_players (round_id, user_id, display_name, avatar_url)
  values (p_round, auth.uid(), coalesce(prof.display_name, prof.twitch_login, 'Spieler'), prof.avatar_url);
  if not r.official and public.is_admin() then
    update public.bingo_rounds set official = true where id = p_round;
  end if;
end;
$$;

-- Ohne p_user: selbst austreten. Mit p_user: Host entfernt einen Mitspieler (nur in der Lobby)
create or replace function public.bingo_leave(p_round bigint, p_user uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.bingo_rounds;
begin
  select * into r from public.bingo_rounds where id = p_round;
  if r.status <> 'lobby' then raise exception 'Nur in der Lobby möglich'; end if;
  if p_user is null or p_user = auth.uid() then
    if r.host_id = auth.uid() then raise exception 'Der Host bleibt in der Runde'; end if;
    delete from public.bingo_round_players where round_id = p_round and user_id = auth.uid();
  elsif r.host_id = auth.uid() then
    delete from public.bingo_round_players where round_id = p_round and user_id = p_user;
  else
    raise exception 'Nur der Host kann Mitspieler entfernen';
  end if;
  -- Ist kein Admin mehr dabei, ist die Runde nicht mehr offiziell
  update public.bingo_rounds rr set official = exists (
    select 1 from public.bingo_round_players p join public.profiles pr on pr.id = p.user_id
    where p.round_id = p_round and pr.role = 'admin'
  ) where rr.id = p_round;
end;
$$;

-- Runde mit einer Karte eröffnen (jeder mit Login; offiziell, sobald ein Admin mitspielt)
create or replace function public.bingo_round_create(p_template bigint, p_title text, p_max_players int)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.bingo_card_templates;
  new_id bigint;
begin
  if auth.uid() is null then raise exception 'Zum Spielen mit Twitch einloggen'; end if;
  select * into t from public.bingo_card_templates where id = p_template;
  if t.id is null then raise exception 'Karte nicht gefunden'; end if;
  -- Aufräumen: nie beendete Runden ohne Admin nach 2 Tagen
  delete from public.bingo_rounds where not official and status <> 'beendet' and created_at < now() - interval '2 days';
  insert into public.bingo_rounds (title, template_id, tasks, max_players, official)
  values (coalesce(nullif(trim(p_title), ''), t.title), t.id, t.tasks, greatest(2, least(8, coalesce(p_max_players, 4))), public.is_admin())
  returning id into new_id;
  perform public.bingo_join(new_id);
  return new_id;
end;
$$;

create or replace function public.bingo_start(p_round bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.bingo_rounds;
begin
  select * into r from public.bingo_rounds where id = p_round for update;
  if r.host_id is distinct from auth.uid() then raise exception 'Nur wer die Runde eröffnet hat, darf starten'; end if;
  if r.status <> 'lobby' then raise exception 'Die Runde läuft schon'; end if;
  update public.bingo_rounds set status = 'laeuft', started_at = now() where id = p_round;
end;
$$;

-- Eigenes Feld ab- oder anhaken (jeder nur auf seiner Karte, solange die Runde läuft)
create or replace function public.bingo_mark(p_round bigint, p_index int, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_index < 0 or p_index > 8 then raise exception 'Ungültiges Feld'; end if;
  if not exists (select 1 from public.bingo_rounds where id = p_round and status = 'laeuft') then
    raise exception 'Die Runde läuft nicht';
  end if;
  update public.bingo_round_players set marks[p_index + 1] = coalesce(p_on, false)
   where round_id = p_round and user_id = auth.uid();
  if not found then raise exception 'Du spielst in dieser Runde nicht mit'; end if;
end;
$$;

-- Beenden: Punkte festhalten, höchste Punktzahl gewinnt (Gleichstand: alle).
-- Ohne Admin → Runde wird gelöscht. Mit Alvi: Stats-Eintrag, geschafft mit voller Karte.
create or replace function public.bingo_finish(p_round bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.bingo_rounds;
  best int;
  creator public.bingo_round_players;
  res text;
  ch bigint;
begin
  select * into r from public.bingo_rounds where id = p_round for update;
  if r.id is null then raise exception 'Runde nicht gefunden'; end if;
  if r.host_id is distinct from auth.uid() then raise exception 'Nur wer die Runde eröffnet hat, darf sie beenden'; end if;
  if r.status = 'beendet' then return r.result; end if;

  if not r.official then
    delete from public.bingo_rounds where id = p_round;
    return 'geloescht';
  end if;

  update public.bingo_round_players set points = public.bingo_points(marks) where round_id = p_round;
  select max(points) into best from public.bingo_round_players where round_id = p_round;
  update public.bingo_round_players set won = (best > 0 and points = best) where round_id = p_round;

  select * into creator from public.bingo_round_players
   where round_id = p_round and public.is_main_creator(user_id) limit 1;
  if creator.user_id is not null then
    res := case when (select bool_and(m) from unnest(creator.marks) m) then 'geschafft' else 'gescheitert' end;
    insert into public.challenges (title, source, status, played_at, config)
    values (
      'Bingo: ' || coalesce(r.title, 'Runde #' || r.id) || ' – ' || creator.points || ' Punkte',
      'bingo', res, coalesce(r.started_at, now()),
      jsonb_build_object(
        'round_id', r.id, 'tasks', to_jsonb(r.tasks), 'points', creator.points,
        'players', (select coalesce(jsonb_agg(jsonb_build_object('name', display_name, 'points', points, 'won', won) order by points desc), '[]'::jsonb)
                    from public.bingo_round_players where round_id = p_round)
      )
    )
    returning id into ch;
  end if;

  update public.bingo_rounds set status = 'beendet', ended_at = now(), result = res, challenge_id = ch where id = p_round;
  return coalesce(res, 'beendet');
end;
$$;

revoke execute on function public.bingo_card_create(text, text[]) from public, anon;
revoke execute on function public.bingo_join(bigint) from public, anon;
revoke execute on function public.bingo_leave(bigint, uuid) from public, anon;
revoke execute on function public.bingo_round_create(bigint, text, int) from public, anon;
revoke execute on function public.bingo_start(bigint) from public, anon;
revoke execute on function public.bingo_mark(bigint, int, boolean) from public, anon;
revoke execute on function public.bingo_finish(bigint) from public, anon;
grant execute on function public.bingo_card_create(text, text[]) to authenticated;
grant execute on function public.bingo_join(bigint) to authenticated;
grant execute on function public.bingo_leave(bigint, uuid) to authenticated;
grant execute on function public.bingo_round_create(bigint, text, int) to authenticated;
grant execute on function public.bingo_start(bigint) to authenticated;
grant execute on function public.bingo_mark(bigint, int, boolean) to authenticated;
grant execute on function public.bingo_finish(bigint) to authenticated;

alter publication supabase_realtime add table public.bingo_rounds, public.bingo_round_players;
