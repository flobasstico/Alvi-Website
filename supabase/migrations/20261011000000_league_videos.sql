-- Creator-Liga: mehrere Videos pro Challenge (je eines pro Creator-Kanal, z. B. Alvis und Magicans Sicht).
-- Die Challenge zählt weiterhin nur einmal; league_challenges.youtube_url bleibt das erste Video (Kompatibilität).

create table if not exists public.league_videos (
  id bigint generated always as identity primary key,
  challenge_id bigint not null references public.league_challenges (id) on delete cascade,
  creator_id bigint not null references public.creators (id) on delete cascade,
  url text not null check (url ~* '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/\S+$'),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (challenge_id, creator_id)
);
create index if not exists league_videos_creator_idx on public.league_videos (creator_id);

alter table public.league_videos enable row level security;
drop policy if exists "lesen" on public.league_videos;
create policy "lesen" on public.league_videos for select using (true);
-- Schreiben nur über league_save_videos (Admins)

-- Bisherige Videos gehören zu Alvis Kanal
insert into public.league_videos (challenge_id, creator_id, url)
select ch.id, a.id, ch.youtube_url
  from public.league_challenges ch
  cross join lateral (
    select c.id from public.creators c
     where c.profile_id = (select p.id from public.profiles p
                            where lower(p.twitch_login) = lower(coalesce((select value from public.site_settings where key = 'main_creator_login'), 'alvivb'))
                            limit 1)
        or lower(trim(c.name)) = 'alvi'
     order by (c.profile_id is null), c.id
     limit 1
  ) a
 where ch.youtube_url is not null
on conflict do nothing;

-- Videos einer Challenge speichern (ersetzt die bisherigen). p_videos: [{creator_id, url}, …], mindestens eins.
create or replace function public.league_save_videos(p_challenge bigint, p_videos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
  first_url text;
begin
  if not public.is_admin() then raise exception 'Nur Admins tragen Liga-Videos ein'; end if;
  if not exists (select 1 from public.league_challenges where id = p_challenge) then raise exception 'Challenge nicht gefunden'; end if;

  drop table if exists pg_temp._v;
  create temp table _v on commit drop as
  select (x->>'creator_id')::bigint as creator_id, trim(x->>'url') as url, ord::int as position
    from jsonb_array_elements(coalesce(p_videos, '[]'::jsonb)) with ordinality as t(x, ord);

  select count(*) into n from _v;
  if n < 1 then raise exception 'Mindestens ein YouTube-Video angeben'; end if;
  if (select count(distinct creator_id) from _v) <> n then raise exception 'Pro Kanal nur ein Video'; end if;
  if exists (select 1 from _v v left join public.creators c on c.id = v.creator_id where c.id is null) then
    raise exception 'Unbekannter Kanal';
  end if;
  if exists (select 1 from _v where coalesce(url, '') !~* '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/\S+$') then
    raise exception 'Bitte nur YouTube-Links (https://youtube.com/… oder https://youtu.be/…)';
  end if;

  delete from public.league_videos where challenge_id = p_challenge;
  insert into public.league_videos (challenge_id, creator_id, url, position)
  select p_challenge, creator_id, url, position from _v;

  select url into first_url from _v order by position limit 1;
  update public.league_challenges set youtube_url = first_url where id = p_challenge;
end;
$$;
revoke all on function public.league_save_videos(bigint, jsonb) from public, anon;
grant execute on function public.league_save_videos(bigint, jsonb) to authenticated;
