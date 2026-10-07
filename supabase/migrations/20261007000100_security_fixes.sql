-- Sicherheits-Korrekturen aus dem Kontrolllauf
--
-- 1) Admin-/Alvi-Erkennung nicht mehr über user_metadata: Die Felder kann jeder eingeloggte Nutzer per
--    supabase.auth.updateUser({ data: { user_name: "alvivb" } }) selbst setzen. Maßgeblich ist nur noch
--    profiles.twitch_login – das wird beim ersten Twitch-Login gesetzt und ist danach gesperrt.
--    Neue Konten bekommen Twitch-Name und Admin-Rolle nur, wenn sie wirklich über Twitch kommen
--    (app_metadata.provider setzt der Server, nicht der Nutzer).
-- 2) Zuschauer-Runden zählen nur, wenn sie gestartet wurden und (außer Winchallenge) mindestens 2 Leute dabei
--    waren; Winchallenge nur nach mindestens 5 Minuten Spielzeit. Sonst ließen sich Siege per Knopfdruck sammeln.
-- 3) Auktionen direkt anlegen: Zuschauer können keine Ergebnis-Spalten (challenge_id, Sieger …) mehr mitgeben.
-- 4) Ergebnisse von Zuschauer-Runden privater Profile sind auch über die API nicht mehr lesbar.

-- ---------- 1) Identität ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  via_twitch boolean := coalesce(new.raw_app_meta_data ->> 'provider', '') = 'twitch';
  login text := case when via_twitch then lower(coalesce(new.raw_user_meta_data ->> 'slug', new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'preferred_username')) end;
begin
  insert into public.profiles (id, twitch_login, display_name, avatar_url, role)
  values (
    new.id,
    login,
    case when via_twitch then coalesce(new.raw_user_meta_data ->> 'nickname', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name') end,
    case when via_twitch then new.raw_user_meta_data ->> 'avatar_url' end,
    case when login is not null and exists (select 1 from public.admin_logins a where a.twitch_login = login) then 'admin' else 'viewer' end
  );
  return new;
end;
$$;

create or replace function public.promote_listed_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set role = 'admin' where lower(twitch_login) = lower(new.twitch_login);
  return new;
end;
$$;

create or replace function public.is_main_creator(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
      join public.site_settings s on s.key = 'main_creator_login'
     where p.id = p_user and lower(p.twitch_login) = lower(trim(s.value))
  );
$$;

-- ---------- 2) Zuschauer-Runden nur mit echter Runde ----------
create or replace function public.escalation_finish(p_session bigint, p_winner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.escalation_sessions;
  snap jsonb;
begin
  select * into s from public.escalation_sessions where id = p_session;
  if s.id is not null and not s.official and s.started_at is not null
     and (select count(*) from public.escalation_players where session_id = p_session) >= 2 then
    select jsonb_agg(jsonb_build_object('user_id', user_id, 'won', user_id = p_winner)) into snap
      from public.escalation_players where session_id = p_session;
  end if;
  perform public.escalation_finish_core(p_session, p_winner);
  if snap is not null and not exists (select 1 from public.escalation_sessions where id = p_session) then
    perform public.record_viewer_round('eskalation', coalesce(s.started_at, s.created_at), snap);
  end if;
end;
$$;

create or replace function public.loadout_finish(p_session bigint, p_winner uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.loadout_sessions;
  snap jsonb;
  res text;
begin
  select * into s from public.loadout_sessions where id = p_session;
  if s.id is not null and not s.official and s.started_at is not null
     and (select count(*) from public.loadout_players where session_id = p_session) >= 2 then
    select jsonb_agg(jsonb_build_object('user_id', user_id, 'won', user_id = p_winner)) into snap
      from public.loadout_players where session_id = p_session;
  end if;
  res := public.loadout_finish_core(p_session, p_winner);
  if res = 'geloescht' and snap is not null then
    perform public.record_viewer_round('loadout', s.created_at, snap);
  end if;
  return res;
end;
$$;

create or replace function public.auction_set_winner(p_auction bigint, p_winner uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.auctions;
  snap jsonb;
  res text;
begin
  select * into a from public.auctions where id = p_auction;
  if a.id is not null and not a.official and a.status <> 'lobby'
     and (select count(*) from public.auction_players where auction_id = p_auction) >= 2 then
    select jsonb_agg(jsonb_build_object('user_id', user_id, 'won', user_id = p_winner)) into snap
      from public.auction_players where auction_id = p_auction;
  end if;
  res := public.auction_set_winner_core(p_auction, p_winner);
  if res = 'geloescht' and snap is not null then
    perform public.record_viewer_round('auktion', a.created_at, snap);
  end if;
  return res;
end;
$$;

create or replace function public.bingo_finish(p_round bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.bingo_rounds;
  snap jsonb;
  best int;
  res text;
begin
  select * into r from public.bingo_rounds where id = p_round;
  if r.id is not null and not r.official and r.status <> 'beendet' and r.started_at is not null
     and (select count(*) from public.bingo_round_players where round_id = p_round) >= 2 then
    select max(public.bingo_points(marks)) into best from public.bingo_round_players where round_id = p_round;
    select jsonb_agg(jsonb_build_object('user_id', user_id, 'points', public.bingo_points(marks), 'won', best > 0 and public.bingo_points(marks) = best))
      into snap from public.bingo_round_players where round_id = p_round;
  end if;
  res := public.bingo_finish_core(p_round);
  if res = 'geloescht' and snap is not null then
    perform public.record_viewer_round('bingo', coalesce(r.started_at, r.created_at), snap);
  end if;
  return res;
end;
$$;

create or replace function public.olympic_finish(p_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.olympics;
  snap jsonb;
  best int;
  res text;
begin
  select * into o from public.olympics where id = p_id;
  if o.id is not null and not o.official and o.status <> 'beendet' and o.started_at is not null
     and (select count(*) from public.olympic_players where olympic_id = p_id) >= 2 then
    perform public.olympic_recalc(p_id);
    select max(points) into best from public.olympic_players where olympic_id = p_id;
    select jsonb_agg(jsonb_build_object('user_id', user_id, 'points', points, 'won', best > 0 and points = best))
      into snap from public.olympic_players where olympic_id = p_id;
  end if;
  res := public.olympic_finish_core(p_id);
  if res = 'geloescht' and snap is not null then
    perform public.record_viewer_round('olympiade', coalesce(o.started_at, o.created_at), snap);
  end if;
  return res;
end;
$$;

create or replace function public.win_finish(p_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.win_challenges;
  snap jsonb;
  res text;
  played numeric;
begin
  select * into w from public.win_challenges where id = p_id;
  played := coalesce(w.elapsed_s, 0) + case when w.status = 'laeuft' and w.started_at is not null then extract(epoch from now() - w.started_at) else 0 end;
  if w.id is not null and not w.official and w.status <> 'beendet' and played >= 300 then
    snap := jsonb_build_array(jsonb_build_object(
      'user_id', w.host_id,
      'won', exists (select 1 from public.win_challenge_games where challenge_id = p_id)
             and not exists (select 1 from public.win_challenge_games where challenge_id = p_id and wins < target)
    ));
  end if;
  res := public.win_finish_core(p_id);
  if res = 'geloescht' and snap is not null then
    perform public.record_viewer_round('winchallenge', coalesce(w.created_at, now()), snap);
  end if;
  return res;
end;
$$;

-- ---------- 3) Auktion: Ergebnis-Spalten beim Anlegen nur für Admins ----------
create or replace function public.set_auction_official()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.official := public.is_admin();
    if not new.official then
      new.challenge_id := null;
      new.winner_id := null;
      new.winner_name := null;
      new.result := null;
      new.decided_at := null;
      new.ended_at := null;
      new.ended_reason := null;
    end if;
  end if;
  return new;
end;
$$;

-- ---------- 4) Private Profile: Zuschauer-Ergebnisse nur für sich selbst ----------
drop policy "Zuschauer-Ergebnisse lesen" on public.viewer_round_players;
create policy "Zuschauer-Ergebnisse lesen" on public.viewer_round_players for select
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = user_id and p.is_public)
  );
