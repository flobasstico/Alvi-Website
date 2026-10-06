-- Zuschauerprofile + Ergebnisse von Zuschauer-Runden
--
-- 1) Profile öffentlich/privat: privat = kein Eintrag in Ranglisten/Tabellen der Website, Profilseite nur für einen selbst.
-- 2) Inoffizielle Runden (ohne Admin) werden beim Beenden weiterhin gelöscht – vorher werden aber
--    Spiel, Datum, Mitspieler, Sieger und Punkte/Platzierung in viewer_rounds festgehalten.
--    Die bestehenden Beenden-Funktionen bleiben unverändert und werden nur umhüllt.

alter table public.profiles add column is_public boolean not null default true;

create or replace function public.set_profile_public(p_public boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Bitte mit Twitch einloggen'; end if;
  update public.profiles set is_public = coalesce(p_public, true) where id = auth.uid();
end;
$$;
revoke execute on function public.set_profile_public(boolean) from public, anon;
grant execute on function public.set_profile_public(boolean) to authenticated;

-- ---------- Ergebnisse von Zuschauer-Runden ----------
create table public.viewer_rounds (
  id bigint generated always as identity primary key,
  game text not null check (game in ('eskalation', 'loadout', 'auktion', 'bingo', 'olympiade', 'winchallenge')),
  played_at timestamptz not null default now()
);
create index viewer_rounds_game_idx on public.viewer_rounds (game, played_at);

create table public.viewer_round_players (
  round_id bigint not null references public.viewer_rounds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  won boolean not null default false,
  points int,
  placement int,
  primary key (round_id, user_id)
);
create index viewer_round_players_user_idx on public.viewer_round_players (user_id);

alter table public.viewer_rounds enable row level security;
alter table public.viewer_round_players enable row level security;
create policy "Zuschauer-Runden lesen" on public.viewer_rounds for select using (true);
create policy "Zuschauer-Ergebnisse lesen" on public.viewer_round_players for select using (true);
grant select on public.viewer_rounds, public.viewer_round_players to anon, authenticated;
-- Admins dürfen einzelne Einträge löschen (z. B. Missbrauch)
create policy "Zuschauer-Runden löschen" on public.viewer_rounds for delete to authenticated using (public.is_admin());
grant delete on public.viewer_rounds to authenticated;

-- Speichert eine Runde; p_players: [{user_id, won, points}] – Platzierung ergibt sich aus Punkten bzw. Sieg
create or replace function public.record_viewer_round(p_game text, p_played_at timestamptz, p_players jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid bigint;
begin
  if coalesce(jsonb_array_length(p_players), 0) = 0 then return; end if;
  insert into public.viewer_rounds (game, played_at) values (p_game, coalesce(p_played_at, now())) returning id into rid;
  insert into public.viewer_round_players (round_id, user_id, won, points, placement)
  select rid, (p->>'user_id')::uuid, coalesce((p->>'won')::boolean, false), (p->>'points')::int,
         case
           when (p->>'points') is not null then
             1 + (select count(*) from jsonb_array_elements(p_players) q where (q->>'points')::int > (p->>'points')::int)
           when coalesce((p->>'won')::boolean, false) then 1
         end
    from jsonb_array_elements(p_players) p
   where p->>'user_id' is not null
  on conflict do nothing;
end;
$$;
revoke execute on function public.record_viewer_round(text, timestamptz, jsonb) from public, anon, authenticated;

-- ---------- Hüllen um die Beenden-Funktionen ----------
-- Muster: Momentaufnahme der Runde, alte Funktion aufrufen (prüft Host & Co.), wurde die Runde
-- dabei als inoffiziell gelöscht → Momentaufnahme speichern. Fehler der alten Funktion rollen alles zurück.

-- Regel-Eskalation
alter function public.escalation_finish(bigint, uuid) rename to escalation_finish_core;
revoke execute on function public.escalation_finish_core(bigint, uuid) from public, anon, authenticated;
create function public.escalation_finish(p_session bigint, p_winner uuid)
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
  if s.id is not null and not s.official then
    select jsonb_agg(jsonb_build_object('user_id', user_id, 'won', user_id = p_winner)) into snap
      from public.escalation_players where session_id = p_session;
  end if;
  perform public.escalation_finish_core(p_session, p_winner);
  if snap is not null and not exists (select 1 from public.escalation_sessions where id = p_session) then
    perform public.record_viewer_round('eskalation', coalesce(s.started_at, s.created_at), snap);
  end if;
end;
$$;

-- Loadout-Würfel
alter function public.loadout_finish(bigint, uuid) rename to loadout_finish_core;
revoke execute on function public.loadout_finish_core(bigint, uuid) from public, anon, authenticated;
create function public.loadout_finish(p_session bigint, p_winner uuid)
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
  if s.id is not null and not s.official then
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

-- Loot-Auktion
alter function public.auction_set_winner(bigint, uuid) rename to auction_set_winner_core;
revoke execute on function public.auction_set_winner_core(bigint, uuid) from public, anon, authenticated;
create function public.auction_set_winner(p_auction bigint, p_winner uuid)
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
  if a.id is not null and not a.official then
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

-- Bingo: Punkte aus den Kreuzen, höchste Punktzahl gewinnt
alter function public.bingo_finish(bigint) rename to bingo_finish_core;
revoke execute on function public.bingo_finish_core(bigint) from public, anon, authenticated;
create function public.bingo_finish(p_round bigint)
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
  if r.id is not null and not r.official and r.status <> 'beendet' then
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

-- Olympiade: Punkte aus den gewonnenen Spielen
alter function public.olympic_finish(bigint) rename to olympic_finish_core;
revoke execute on function public.olympic_finish_core(bigint) from public, anon, authenticated;
create function public.olympic_finish(p_id bigint)
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
  if o.id is not null and not o.official and o.status <> 'beendet' then
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

-- Winchallenge: Host spielt allein, „gewonnen“ = alle Spiele geschafft
alter function public.win_finish(bigint) rename to win_finish_core;
revoke execute on function public.win_finish_core(bigint) from public, anon, authenticated;
create function public.win_finish(p_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.win_challenges;
  snap jsonb;
  res text;
begin
  select * into w from public.win_challenges where id = p_id;
  if w.id is not null and not w.official and w.status <> 'beendet' then
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

revoke execute on function public.escalation_finish(bigint, uuid) from public, anon;
revoke execute on function public.loadout_finish(bigint, uuid) from public, anon;
revoke execute on function public.auction_set_winner(bigint, uuid) from public, anon;
revoke execute on function public.bingo_finish(bigint) from public, anon;
revoke execute on function public.olympic_finish(bigint) from public, anon;
revoke execute on function public.win_finish(bigint) from public, anon;
grant execute on function public.escalation_finish(bigint, uuid) to authenticated;
grant execute on function public.loadout_finish(bigint, uuid) to authenticated;
grant execute on function public.auction_set_winner(bigint, uuid) to authenticated;
grant execute on function public.bingo_finish(bigint) to authenticated;
grant execute on function public.olympic_finish(bigint) to authenticated;
grant execute on function public.win_finish(bigint) to authenticated;
