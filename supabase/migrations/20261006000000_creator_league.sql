-- Creator-Liga: Challenges, die außerhalb der Website gespielt werden (Boxfights, Hide & Seek …),
-- getrennt von den Website-Stats. Liga-Seasons, Ligapunkte nach Platzierung (Schema je Season, Standard 3/2/1),
-- jede Challenge mit YouTube-Link. Eintragen nur Admins.

create table public.league_seasons (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 60),
  is_current boolean not null default false,
  points_scheme int[] not null default '{3,2,1}' check (cardinality(points_scheme) between 1 and 10),
  created_at timestamptz not null default now()
);
create unique index league_seasons_one_current on public.league_seasons (is_current) where is_current;

create table public.creators (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 40),
  avatar_url text,
  profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index creators_name_idx on public.creators (lower(name));
create index creators_profile_idx on public.creators (profile_id);

create table public.league_challenges (
  id bigint generated always as identity primary key,
  season_id bigint not null references public.league_seasons (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  category text check (char_length(category) <= 40),
  played_at date not null default current_date,
  scoring text not null check (scoring in ('sieg', 'punkte')),
  youtube_url text not null check (youtube_url ~* '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/\S+$'),
  created_at timestamptz not null default now()
);
create index league_challenges_season_idx on public.league_challenges (season_id, played_at);

create table public.league_results (
  challenge_id bigint not null references public.league_challenges (id) on delete cascade,
  creator_id bigint not null references public.creators (id) on delete cascade,
  placement int not null check (placement >= 1),
  points int,
  won boolean not null default false,
  primary key (challenge_id, creator_id)
);
create index league_results_creator_idx on public.league_results (creator_id);

alter table public.league_seasons enable row level security;
alter table public.creators enable row level security;
alter table public.league_challenges enable row level security;
alter table public.league_results enable row level security;
create policy "lesen" on public.league_seasons for select using (true);
create policy "lesen" on public.creators for select using (true);
create policy "lesen" on public.league_challenges for select using (true);
create policy "lesen" on public.league_results for select using (true);
create policy "admin schreiben" on public.league_seasons for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin schreiben" on public.creators for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin schreiben" on public.league_challenges for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin schreiben" on public.league_results for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Challenge anlegen oder ändern. p_results: [{"creator_id": 1, "won": true, "points": 12, "placement": 2}, …]
-- Wertung „sieg“: Sieger = Platz 1, optional angegebene Plätze (2, 3 …) übernehmen, Rest = letzter Platz.
-- Wertung „punkte“: Platz nach Punkten (Gleichstand = gleicher Platz), höchste Punktzahl gewinnt.
create or replace function public.league_save_challenge(
  p_id bigint, p_season bigint, p_title text, p_category text, p_played_at date, p_scoring text, p_video text, p_results jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid bigint;
  n int;
  winners int;
  last_place int;
begin
  if not public.is_admin() then raise exception 'Nur Admins tragen Liga-Challenges ein'; end if;
  if p_scoring not in ('sieg', 'punkte') then raise exception 'Unbekannte Wertung'; end if;
  if nullif(trim(p_title), '') is null then raise exception 'Bitte einen Titel eingeben'; end if;
  if coalesce(trim(p_video), '') !~* '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/\S+$' then
    raise exception 'Bitte einen YouTube-Link angeben (https://youtube.com/… oder https://youtu.be/…)';
  end if;
  if not exists (select 1 from public.league_seasons where id = p_season) then raise exception 'Liga-Season nicht gefunden'; end if;

  drop table if exists pg_temp._r;
  create temp table _r on commit drop as
  select (x->>'creator_id')::bigint as creator_id,
         coalesce((x->>'won')::boolean, false) as won,
         nullif(x->>'points', '')::int as points,
         nullif(x->>'placement', '')::int as placement
    from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) x;

  select count(*) into n from _r;
  if n < 2 then raise exception 'Mindestens 2 Teilnehmer'; end if;
  if (select count(distinct creator_id) from _r) <> n then raise exception 'Jeder Creator nur einmal'; end if;
  if exists (select 1 from _r r left join public.creators c on c.id = r.creator_id where c.id is null) then
    raise exception 'Unbekannter Creator';
  end if;

  if p_scoring = 'punkte' then
    if exists (select 1 from _r where points is null) then raise exception 'Bitte für jeden Teilnehmer Punkte eintragen'; end if;
    update _r set placement = sub.rk, won = sub.rk = 1
      from (select creator_id, rank() over (order by points desc) rk from _r) sub
     where sub.creator_id = _r.creator_id;
  else
    select count(*) into winners from _r where won;
    if winners < 1 then raise exception 'Bitte den Sieger markieren'; end if;
    update _r set placement = 1 where won;
    update _r set placement = null where not won and (placement is null or placement < 2);
    select coalesce(max(placement), 1) + 1 into last_place from _r;
    update _r set placement = last_place where placement is null;
  end if;

  if p_id is null then
    insert into public.league_challenges (season_id, title, category, played_at, scoring, youtube_url)
    values (p_season, left(trim(p_title), 80), nullif(left(trim(coalesce(p_category, '')), 40), ''), coalesce(p_played_at, current_date), p_scoring, trim(p_video))
    returning id into cid;
  else
    update public.league_challenges
       set season_id = p_season, title = left(trim(p_title), 80), category = nullif(left(trim(coalesce(p_category, '')), 40), ''),
           played_at = coalesce(p_played_at, played_at), scoring = p_scoring, youtube_url = trim(p_video)
     where id = p_id
    returning id into cid;
    if cid is null then raise exception 'Challenge nicht gefunden'; end if;
    delete from public.league_results where challenge_id = cid;
  end if;

  insert into public.league_results (challenge_id, creator_id, placement, points, won)
  select cid, creator_id, placement, points, won from _r;
  return cid;
end;
$$;
revoke execute on function public.league_save_challenge(bigint, bigint, text, text, date, text, text, jsonb) from public, anon;
grant execute on function public.league_save_challenge(bigint, bigint, text, text, date, text, text, jsonb) to authenticated;

-- Admins löschen Liga-Challenges über die bestehende Lösch-Funktion (Art 'liga')
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
  elsif p_kind = 'liga' then
    delete from public.league_challenges where id = p_id;
    if not found then raise exception 'Liga-Challenge nicht gefunden'; end if;
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

-- Erste Season, damit sofort eingetragen werden kann
insert into public.league_seasons (name, is_current) values ('Season 1', true);
