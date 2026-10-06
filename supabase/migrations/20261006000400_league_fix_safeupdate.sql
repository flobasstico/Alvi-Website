-- Fix: „UPDATE requires a WHERE clause“ beim Eintragen einer Liga-Challenge
create or replace function public.league_save_challenge(
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
  if p_scoring <> 'sieg' then raise exception 'Wertung nur noch über Sieger und Plätze'; end if;
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

  select count(*) into winners from _r where won;
  if winners < 1 then raise exception 'Bitte den Sieger markieren'; end if;
  -- Supabase (safeupdate) verlangt bei jedem UPDATE eine WHERE-Bedingung
  update _r set points = null where points is not null;
  update _r set placement = 1 where won;
  update _r set placement = null where not won and (placement is null or placement < 2);
  select coalesce(max(placement), 1) + 1 into last_place from _r;
  update _r set placement = last_place where placement is null;

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
