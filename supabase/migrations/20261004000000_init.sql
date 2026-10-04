-- Alvi Challenge-Website: Grundschema

-- ---------- Profile & Rollen ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  twitch_login text,
  display_name text,
  avatar_url text,
  role text not null default 'viewer' check (role in ('viewer', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, twitch_login, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'slug', new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'preferred_username'),
    coalesce(new.raw_user_meta_data ->> 'nickname', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rolle darf von Nutzern nicht selbst geändert werden
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- SQL-Editor/Service-Rolle (postgres) darf Rollen vergeben
  if new.role is distinct from old.role
     and current_user in ('anon', 'authenticated')
     and not public.is_admin() then
    raise exception 'Rolle darf nicht geändert werden';
  end if;
  return new;
end;
$$;

create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------- Stammdaten ----------
create table public.seasons (
  id bigint generated always as identity primary key,
  name text not null,
  is_current boolean not null default false,
  map_image_url text,
  created_at timestamptz not null default now()
);
create unique index seasons_one_current on public.seasons (is_current) where is_current;

create table public.rules (
  id bigint generated always as identity primary key,
  text text not null,
  category text not null default 'rad' check (category in ('rad', 'drop')),
  weight int not null default 1 check (weight between 1 and 10),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.loot_items (
  id bigint generated always as identity primary key,
  name text not null,
  rarity text not null check (rarity in ('grau', 'gruen', 'blau', 'lila', 'gold', 'mythisch')),
  type text not null check (type in ('waffe', 'heilung', 'utility')),
  season_id bigint references public.seasons (id) on delete cascade,
  icon_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index loot_items_season_idx on public.loot_items (season_id);

create table public.drop_spots (
  id bigint generated always as identity primary key,
  name text not null,
  season_id bigint references public.seasons (id) on delete cascade,
  x numeric(5,2) not null check (x between 0 and 100),
  y numeric(5,2) not null check (y between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index drop_spots_season_idx on public.drop_spots (season_id);

-- ---------- Challenges (zentrale Historie) ----------
create table public.challenges (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  source text not null check (source in ('rad', 'loadout', 'drop', 'voting', 'versus', 'bingo', 'manuell')),
  config jsonb not null default '{}'::jsonb,
  status text not null default 'geplant' check (status in ('geplant', 'aktiv', 'geschafft', 'gescheitert')),
  video_url text,
  played_at timestamptz,
  created_at timestamptz not null default now()
);
create index challenges_status_idx on public.challenges (status);

-- ---------- Community-Voting ----------
create table public.submissions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 500),
  week text not null default '',
  status text not null default 'offen' check (status in ('offen', 'freigegeben', 'abgelehnt')),
  challenge_id bigint references public.challenges (id) on delete set null,
  created_at timestamptz not null default now()
);
create index submissions_week_idx on public.submissions (week);
create index submissions_user_idx on public.submissions (user_id);
create index submissions_challenge_idx on public.submissions (challenge_id);

create table public.votes (
  submission_id bigint not null references public.submissions (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (submission_id, user_id)
);
create index votes_user_idx on public.votes (user_id);

-- Woche wird serverseitig gesetzt (ISO-Woche, Europe/Berlin)
create or replace function public.current_week()
returns text
language sql
stable
set search_path = ''
as $$
  select to_char(now() at time zone 'Europe/Berlin', 'IYYY-"W"IW');
$$;

create or replace function public.set_submission_week()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.week := public.current_week();
  return new;
end;
$$;

create trigger set_submission_week
  before insert on public.submissions
  for each row execute function public.set_submission_week();

create view public.submission_scores
with (security_invoker = true) as
select s.*, coalesce(v.cnt, 0)::int as votes,
       p.display_name as author_name
from public.submissions s
left join (select submission_id, count(*) as cnt from public.votes group by submission_id) v
  on v.submission_id = s.id
left join public.profiles p on p.id = s.user_id;

-- ---------- Versus ----------
create table public.versus_matches (
  id bigint generated always as identity primary key,
  opponent_name text not null,
  title text,
  score_alvi int not null default 0,
  score_opponent int not null default 0,
  duration_s int not null default 1800,
  started_at timestamptz,
  paused_remaining_s int,
  status text not null default 'bereit' check (status in ('bereit', 'laeuft', 'pausiert', 'beendet')),
  challenge_id bigint references public.challenges (id) on delete set null,
  created_at timestamptz not null default now()
);
create index versus_matches_challenge_idx on public.versus_matches (challenge_id);

create table public.versus_checklist (
  id bigint generated always as identity primary key,
  match_id bigint not null references public.versus_matches (id) on delete cascade,
  text text not null,
  alvi_done boolean not null default false,
  opponent_done boolean not null default false,
  position int not null default 0
);
create index versus_checklist_match_idx on public.versus_checklist (match_id);

-- ---------- Bingo ----------
create table public.bingo_tasks (
  id bigint generated always as identity primary key,
  text text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.bingo_games (
  id bigint generated always as identity primary key,
  title text,
  status text not null default 'laeuft' check (status in ('laeuft', 'beendet')),
  task_ids bigint[] not null,
  challenge_id bigint references public.challenges (id) on delete set null,
  started_at timestamptz not null default now()
);
create index bingo_games_challenge_idx on public.bingo_games (challenge_id);

create table public.bingo_marks (
  game_id bigint not null references public.bingo_games (id) on delete cascade,
  task_id bigint not null references public.bingo_tasks (id) on delete cascade,
  marked_at timestamptz not null default now(),
  primary key (game_id, task_id)
);
create index bingo_marks_task_idx on public.bingo_marks (task_id);

create table public.bingo_cards (
  game_id bigint not null references public.bingo_games (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  task_ids bigint[] not null check (array_length(task_ids, 1) = 25),
  bingo_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index bingo_cards_user_idx on public.bingo_cards (user_id);

-- Bingo-Zeitpunkt wird serverseitig berechnet (Mitte = Freifeld, Index 12)
create or replace function public.card_has_bingo(p_task_ids bigint[], p_game_id bigint)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  marked boolean[] := array_fill(false, array[25]);
  lines int[][] := array[
    [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
    [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
    [0,6,12,18,24],[4,8,12,16,20]
  ];
  i int; j int; ok boolean;
begin
  for i in 1..25 loop
    marked[i] := (i = 13) or exists (
      select 1 from public.bingo_marks m
      where m.game_id = p_game_id and m.task_id = p_task_ids[i]
    );
  end loop;
  for i in 1..12 loop
    ok := true;
    for j in 1..5 loop
      if not marked[lines[i][j] + 1] then ok := false; exit; end if;
    end loop;
    if ok then return true; end if;
  end loop;
  return false;
end;
$$;

create or replace function public.update_bingo_winners()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bingo_cards c
     set bingo_at = now()
   where c.game_id = new.game_id
     and c.bingo_at is null
     and public.card_has_bingo(c.task_ids, c.game_id);
  return new;
end;
$$;

create trigger bingo_marks_winners
  after insert on public.bingo_marks
  for each row execute function public.update_bingo_winners();

-- Zuschauer-Karten dürfen nur Tasks der laufenden Runde enthalten
create or replace function public.validate_bingo_card()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.bingo_games g
    where g.id = new.game_id and g.status = 'laeuft' and new.task_ids <@ g.task_ids
  ) or (select count(distinct t) from unnest(new.task_ids) t) <> 25 then
    raise exception 'Ungültige Bingo-Karte';
  end if;
  new.bingo_at := case when public.card_has_bingo(new.task_ids, new.game_id) then now() end;
  return new;
end;
$$;

create trigger validate_bingo_card
  before insert on public.bingo_cards
  for each row execute function public.validate_bingo_card();

-- ---------- Stats ----------
create view public.challenge_stats
with (security_invoker = true) as
select source,
       count(*) filter (where status in ('geschafft', 'gescheitert'))::int as finished,
       count(*) filter (where status = 'geschafft')::int as won,
       count(*) filter (where status = 'gescheitert')::int as lost,
       count(*)::int as total
from public.challenges
group by rollup (source);

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.rules enable row level security;
alter table public.loot_items enable row level security;
alter table public.drop_spots enable row level security;
alter table public.challenges enable row level security;
alter table public.submissions enable row level security;
alter table public.votes enable row level security;
alter table public.versus_matches enable row level security;
alter table public.versus_checklist enable row level security;
alter table public.bingo_tasks enable row level security;
alter table public.bingo_games enable row level security;
alter table public.bingo_marks enable row level security;
alter table public.bingo_cards enable row level security;

-- Öffentlich lesbar
create policy "lesen" on public.profiles for select using (true);
create policy "lesen" on public.seasons for select using (true);
create policy "lesen" on public.rules for select using (true);
create policy "lesen" on public.loot_items for select using (true);
create policy "lesen" on public.drop_spots for select using (true);
create policy "lesen" on public.challenges for select using (true);
create policy "lesen" on public.submissions for select using (true);
create policy "lesen" on public.votes for select using (true);
create policy "lesen" on public.versus_matches for select using (true);
create policy "lesen" on public.versus_checklist for select using (true);
create policy "lesen" on public.bingo_tasks for select using (true);
create policy "lesen" on public.bingo_games for select using (true);
create policy "lesen" on public.bingo_marks for select using (true);
create policy "lesen" on public.bingo_cards for select using (true);

-- Admin schreibt Stammdaten & Live-Tools
create policy "admin insert" on public.seasons for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.seasons for update to authenticated using ((select public.is_admin()));
create policy "admin delete" on public.seasons for delete to authenticated using ((select public.is_admin()));
create policy "admin insert" on public.rules for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.rules for update to authenticated using ((select public.is_admin()));
create policy "admin delete" on public.rules for delete to authenticated using ((select public.is_admin()));
create policy "admin insert" on public.loot_items for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.loot_items for update to authenticated using ((select public.is_admin()));
create policy "admin delete" on public.loot_items for delete to authenticated using ((select public.is_admin()));
create policy "admin insert" on public.drop_spots for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.drop_spots for update to authenticated using ((select public.is_admin()));
create policy "admin delete" on public.drop_spots for delete to authenticated using ((select public.is_admin()));
create policy "admin insert" on public.challenges for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.challenges for update to authenticated using ((select public.is_admin()));
create policy "admin delete" on public.challenges for delete to authenticated using ((select public.is_admin()));
create policy "admin insert" on public.versus_matches for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.versus_matches for update to authenticated using ((select public.is_admin()));
create policy "admin delete" on public.versus_matches for delete to authenticated using ((select public.is_admin()));
create policy "admin insert" on public.versus_checklist for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.versus_checklist for update to authenticated using ((select public.is_admin()));
create policy "admin delete" on public.versus_checklist for delete to authenticated using ((select public.is_admin()));
create policy "admin insert" on public.bingo_tasks for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.bingo_tasks for update to authenticated using ((select public.is_admin()));
create policy "admin delete" on public.bingo_tasks for delete to authenticated using ((select public.is_admin()));
create policy "admin insert" on public.bingo_games for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.bingo_games for update to authenticated using ((select public.is_admin()));
create policy "admin delete" on public.bingo_games for delete to authenticated using ((select public.is_admin()));
create policy "admin insert" on public.bingo_marks for insert to authenticated with check ((select public.is_admin()));
create policy "admin delete" on public.bingo_marks for delete to authenticated using ((select public.is_admin()));

-- Profile: eigenes Profil bearbeiten
create policy "eigenes profil" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Submissions: eigene einreichen; Admin moderiert
create policy "einreichen" on public.submissions for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'offen' and challenge_id is null);
create policy "admin update" on public.submissions for update to authenticated using ((select public.is_admin()));
create policy "loeschen" on public.submissions for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Votes: eigene
create policy "voten" on public.votes for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.submissions s
    where s.id = submission_id and s.status <> 'abgelehnt' and s.week = public.current_week()
  )
);
create policy "vote zurueck" on public.votes for delete to authenticated using (user_id = (select auth.uid()));

-- Bingo-Karten: eigene (bingo_at setzt nur der Trigger)
create policy "karte holen" on public.bingo_cards for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------- Realtime ----------
alter publication supabase_realtime add table
  public.votes, public.submissions, public.versus_matches, public.versus_checklist,
  public.bingo_games, public.bingo_marks, public.bingo_cards;
