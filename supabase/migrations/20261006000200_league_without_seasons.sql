-- Creator-Liga ohne Seasons: eine ewige Tabelle. Ligapunkte fest: 1. Platz 3, 2. Platz 2, 3. Platz 1.
drop function if exists public.league_save_challenge(bigint, bigint, text, text, date, text, text, jsonb);
alter table public.league_challenges drop column season_id;
drop table public.league_seasons;
create index if not exists league_challenges_played_idx on public.league_challenges (played_at);

-- Challenge anlegen oder ändern. p_results: [{"creator_id": 1, "won": true, "points": 12, "placement": 2}, …]
-- Wertung „sieg“: Sieger = Platz 1, optional angegebene Plätze (2, 3 …) übernehmen, Rest = letzter Platz.
-- Wertung „punkte“: Platz nach Punkten (Gleichstand = gleicher Platz), höchste Punktzahl gewinnt.
create function public.league_save_challenge(
  p_id bigint, p_title text, p_category text, p_played_at date, p_scoring text, p_video text, p_results jsonb
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
    insert into public.league_challenges (title, category, played_at, scoring, youtube_url)
    values (left(trim(p_title), 80), nullif(left(trim(coalesce(p_category, '')), 40), ''), coalesce(p_played_at, current_date), p_scoring, trim(p_video))
    returning id into cid;
  else
    update public.league_challenges
       set title = left(trim(p_title), 80), category = nullif(left(trim(coalesce(p_category, '')), 40), ''),
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
revoke execute on function public.league_save_challenge(bigint, text, text, date, text, text, jsonb) from public, anon;
grant execute on function public.league_save_challenge(bigint, text, text, date, text, text, jsonb) to authenticated;
