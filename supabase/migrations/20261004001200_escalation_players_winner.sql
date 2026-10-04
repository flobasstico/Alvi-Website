-- Regel-Eskalation: Mitspieler treten per Login bei, der Host beendet die Runde und wählt den Sieger.
-- Statistik: Bestenliste „Siege pro Spieler“; für Alvis Quote zählt Alvi-Sieg = geschafft, sonst gescheitert.

-- Einstellungen (nur per SQL-Editor pflegbar): wessen Erfolgsquote die Stats zeigen
create table public.site_settings (
  key text primary key,
  value text not null
);
alter table public.site_settings enable row level security;
create policy "lesen" on public.site_settings for select using (true);
insert into public.site_settings (key, value) values ('main_creator_login', 'alvivb');

create table public.escalation_players (
  session_id bigint not null references public.escalation_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text,
  avatar_url text,
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index escalation_players_user_idx on public.escalation_players (user_id);

alter table public.escalation_sessions
  add column winner_id uuid references public.profiles (id) on delete set null,
  add column winner_name text;
create index escalation_sessions_winner_idx on public.escalation_sessions (winner_id);

alter table public.escalation_players enable row level security;
create policy "lesen" on public.escalation_players for select using (true);

-- Ist dieser Nutzer der Haupt-Creator (Alvi)?
create or replace function public.is_main_creator(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.site_settings s on s.key = 'main_creator_login'
    left join public.profiles p on p.id = u.id
    where u.id = p_user
      and (lower(p.twitch_login) = lower(s.value) or lower(s.value) = any (public.twitch_names(u.raw_user_meta_data)))
  );
$$;

create or replace function public.escalation_join(p_session bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.escalation_sessions;
  prof public.profiles;
begin
  if auth.uid() is null then raise exception 'Bitte einloggen'; end if;
  select * into s from public.escalation_sessions where id = p_session;
  if s.id is null then raise exception 'Runde nicht gefunden'; end if;
  if s.status = 'beendet' then raise exception 'Die Runde ist schon beendet'; end if;
  select * into prof from public.profiles where id = auth.uid();
  insert into public.escalation_players (session_id, user_id, display_name, avatar_url)
  values (p_session, auth.uid(), coalesce(prof.display_name, prof.twitch_login, 'Spieler'), prof.avatar_url)
  on conflict do nothing;
end;
$$;

-- Ohne p_user: selbst austreten. Mit p_user: Host entfernt einen Mitspieler.
create or replace function public.escalation_leave(p_session bigint, p_user uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.escalation_sessions;
begin
  select * into s from public.escalation_sessions where id = p_session;
  if s.status = 'beendet' then raise exception 'Die Runde ist schon beendet'; end if;
  if p_user is null or p_user = auth.uid() then
    if s.host_id = auth.uid() then raise exception 'Der Host bleibt in der Runde'; end if;
    delete from public.escalation_players where session_id = p_session and user_id = auth.uid();
  elsif s.host_id = auth.uid() then
    delete from public.escalation_players where session_id = p_session and user_id = p_user;
  else
    raise exception 'Nur der Host kann Mitspieler entfernen';
  end if;
end;
$$;

-- Runde beenden. p_winner = Sieger (muss Mitspieler sein) oder null = ohne Wertung.
create or replace function public.escalation_finish(p_session bigint, p_winner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.escalation_sessions;
  w public.escalation_players;
  ch bigint;
  rules jsonb;
  res text;
begin
  perform public.escalation_tick(p_session);
  select * into s from public.escalation_sessions where id = p_session for update;
  if s.id is null then raise exception 'Runde nicht gefunden'; end if;
  if s.host_id is distinct from auth.uid() then raise exception 'Nur wer die Runde eröffnet hat, darf sie beenden'; end if;
  if s.status = 'beendet' then raise exception 'Die Runde ist schon beendet'; end if;

  if p_winner is not null then
    select * into w from public.escalation_players where session_id = p_session and user_id = p_winner;
    if w.user_id is null then raise exception 'Der Sieger muss Mitspieler der Runde sein'; end if;
    res := case when public.is_main_creator(p_winner) then 'geschafft' else 'gescheitert' end;

    select coalesce(jsonb_agg(text order by position), '[]'::jsonb) into rules
    from public.escalation_session_rules where session_id = p_session;
    insert into public.challenges (title, source, status, played_at, config)
    values (
      'Regel-Eskalation' || coalesce(': ' || s.title, '') || ' – ' || w.display_name || ' gewinnt',
      'eskalation', res, coalesce(s.started_at, now()),
      jsonb_build_object(
        'session_id', s.id, 'rules', rules, 'interval_s', s.interval_s, 'winner', w.display_name,
        'players', (select coalesce(jsonb_agg(display_name order by joined_at), '[]'::jsonb) from public.escalation_players where session_id = p_session)
      )
    )
    returning id into ch;
  end if;

  update public.escalation_sessions
     set status = 'beendet', ended_at = now(), result = res, challenge_id = ch,
         winner_id = p_winner, winner_name = w.display_name
   where id = p_session;
end;
$$;

-- Host ist automatisch Mitspieler
create or replace function public.escalation_create(p_title text, p_interval_s int)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if not public.is_admin() then raise exception 'Nur Admins können eine Regel-Eskalation eröffnen'; end if;
  if not exists (select 1 from public.escalation_rules where active) then
    raise exception 'Der Regelpool ist leer – zuerst Regeln im Admin-Bereich anlegen';
  end if;
  insert into public.escalation_sessions (title, interval_s)
  values (nullif(trim(p_title), ''), greatest(30, least(3600, coalesce(p_interval_s, 240))))
  returning id into new_id;
  perform public.escalation_join(new_id);
  return new_id;
end;
$$;

-- Bestenliste: Siege pro Spieler
create view public.escalation_leaderboard
with (security_invoker = true) as
select s.winner_id, max(s.winner_name) as name, count(*)::int as wins, max(s.ended_at) as last_win
from public.escalation_sessions s
where s.winner_id is not null
group by s.winner_id;

-- Alte Beenden-Funktion (Geschafft/Gescheitert ohne Sieger) wird nicht mehr benutzt
revoke execute on function public.escalation_stop(bigint, text) from public, anon, authenticated;

revoke execute on function public.is_main_creator(uuid) from public, anon, authenticated;
revoke execute on function public.escalation_join(bigint) from public, anon;
revoke execute on function public.escalation_leave(bigint, uuid) from public, anon;
revoke execute on function public.escalation_finish(bigint, uuid) from public, anon;
grant execute on function public.escalation_join(bigint) to authenticated;
grant execute on function public.escalation_leave(bigint, uuid) to authenticated;
grant execute on function public.escalation_finish(bigint, uuid) to authenticated;

alter publication supabase_realtime add table public.escalation_players;
