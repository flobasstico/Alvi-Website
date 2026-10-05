-- „Nachspielen“: Zuschauer (Twitch-Login) können abgeschlossene Regel-Eskalationen und Winchallenges
-- identisch nachspielen. Eine Runde ist „offiziell“, sobald ein Admin mitmacht – nur offizielle Runden
-- erscheinen in Übersichten und Stats. Nicht-offizielle Runden werden beim Beenden gelöscht.

-- ---------- Regel-Eskalation ----------
alter table public.escalation_sessions
  add column official boolean not null default true,
  add column replay_of bigint references public.escalation_sessions (id) on delete set null,
  add column script jsonb;   -- [{ "rule_id": 1, "text": "…" }, …] – feste Regelfolge (Position 1 = Grundregel)
create index escalation_sessions_replay_idx on public.escalation_sessions (replay_of);

-- Beitreten: macht ein Admin mit, wird die Runde offiziell
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
  select * into s from public.escalation_sessions where id = p_session for update;
  if s.id is null then raise exception 'Runde nicht gefunden'; end if;
  if s.status = 'beendet' then raise exception 'Die Runde ist schon beendet'; end if;
  if exists (select 1 from public.escalation_players where session_id = p_session and user_id = auth.uid()) then return; end if;
  if (select count(*) from public.escalation_players where session_id = p_session) >= s.max_players then
    raise exception 'Alle % Plätze sind belegt', s.max_players;
  end if;
  select * into prof from public.profiles where id = auth.uid();
  insert into public.escalation_players (session_id, user_id, display_name, avatar_url)
  values (p_session, auth.uid(), coalesce(prof.display_name, prof.twitch_login, 'Spieler'), prof.avatar_url)
  on conflict do nothing;
  if not s.official and public.is_admin() then
    update public.escalation_sessions set official = true where id = p_session;
  end if;
end;
$$;

-- Nachspielen: exakt gleiche Regelfolge und Taktung, Zufallsmodus (die Chat-Abstimmung gehört zum Original)
create or replace function public.escalation_replay(p_source bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  src public.escalation_sessions;
  seq jsonb;
  new_id bigint;
begin
  if auth.uid() is null then raise exception 'Zum Nachspielen mit Twitch einloggen'; end if;
  select * into src from public.escalation_sessions where id = p_source;
  if src.id is null or src.status <> 'beendet' or not src.official then raise exception 'Diese Runde kann nicht nachgespielt werden'; end if;
  select jsonb_agg(jsonb_build_object('rule_id', rule_id, 'text', text) order by position) into seq
  from public.escalation_session_rules where session_id = p_source;
  if seq is null then raise exception 'Die Runde hat keine Regeln'; end if;

  -- Aufräumen: liegengebliebene, nie beendete Nachspiel-Runden
  delete from public.escalation_sessions where not official and status <> 'beendet' and created_at < now() - interval '2 days';

  insert into public.escalation_sessions (title, interval_s, mode, max_players, official, replay_of, script)
  values (
    'Nachgespielt: ' || coalesce(src.title, 'Regel-Eskalation #' || src.id), src.interval_s, 'zufall', src.max_players,
    public.is_admin(), src.id, seq
  )
  returning id into new_id;
  perform public.escalation_join(new_id);
  return new_id;
end;
$$;

-- Grundregel: bei Nachspiel-Runden die des Originals
create or replace function public.escalation_draw_base(p_session bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.escalation_sessions;
  r public.escalation_rules;
  first jsonb;
begin
  select * into s from public.escalation_sessions where id = p_session for update;
  if s.id is null then raise exception 'Runde nicht gefunden'; end if;
  if s.host_id is distinct from auth.uid() then raise exception 'Nur wer die Runde eröffnet hat, darf drehen'; end if;
  if exists (select 1 from public.escalation_session_rules where session_id = p_session) then
    raise exception 'Die Grundregel steht schon fest';
  end if;
  if s.script is not null then
    first := s.script -> 0;
    insert into public.escalation_session_rules (session_id, position, rule_id, text)
    values (p_session, 1, (select x.id from public.escalation_rules x where x.id = (first ->> 'rule_id')::bigint), first ->> 'text');
    return (select x.id from public.escalation_rules x where x.id = (first ->> 'rule_id')::bigint);
  end if;
  select * into r from public.escalation_rules where active and kind = 'grund' order by random() limit 1;
  if r.id is null then raise exception 'Der Grundregel-Pool ist leer'; end if;
  insert into public.escalation_session_rules (session_id, position, rule_id, text) values (p_session, 1, r.id, r.text);
  return r.id;
end;
$$;

-- Fällige Regeln nachziehen. Nachspiel-Runden folgen der festen Regelfolge des Originals.
create or replace function public.escalation_tick(p_session bigint)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.escalation_sessions;
  due int;
  have int;
  r public.escalation_rules;
  p public.escalation_polls;
  win int;
  win_votes int;
  total int;
  opt jsonb;
  due_at timestamptz;
begin
  select * into s from public.escalation_sessions where id = p_session for update;
  if s.id is null or s.status <> 'laeuft' then
    return (select count(*) from public.escalation_session_rules where session_id = p_session);
  end if;
  due := floor(extract(epoch from (now() - s.started_at)) / s.interval_s)::int;
  select count(*) - 1 into have from public.escalation_session_rules where session_id = p_session;

  while have < due loop
    due_at := s.started_at + make_interval(secs => (have + 1) * s.interval_s);

    if s.script is not null then
      opt := s.script -> (have + 1);
      if opt is null then
        update public.escalation_sessions set pool_exhausted = true where id = p_session and not pool_exhausted;
        exit;
      end if;
      have := have + 1;
      insert into public.escalation_session_rules (session_id, position, rule_id, text, added_at)
      values (p_session, have + 1, (select x.id from public.escalation_rules x where x.id = (opt ->> 'rule_id')::bigint), opt ->> 'text', due_at);
      -- Letzte Regel des Originals erreicht → Timer zeigt sofort „Alle Regeln gezogen“
      if have + 1 >= jsonb_array_length(s.script) then
        update public.escalation_sessions set pool_exhausted = true where id = p_session and not pool_exhausted;
        exit;
      end if;
    elsif s.mode = 'chat' then
      select * into p from public.escalation_polls where session_id = p_session and position = have + 2;
      if p.id is null then
        exit when not public.escalation_open_poll(p_session, have + 2, due_at - make_interval(secs => s.interval_s), due_at);
        select * into p from public.escalation_polls where session_id = p_session and position = have + 2;
      end if;

      select coalesce(sum(votes), 0)::int into total from public.escalation_poll_counts where poll_id = p.id;
      select o.n, coalesce(c.votes, 0) into win, win_votes
      from generate_series(1, jsonb_array_length(p.options)) o(n)
      left join public.escalation_poll_counts c on c.poll_id = p.id and c.option = o.n
      order by coalesce(c.votes, 0) desc, random()
      limit 1;
      opt := p.options -> (win - 1);

      have := have + 1;
      insert into public.escalation_session_rules (session_id, position, rule_id, text, added_at)
      values (p_session, have + 1, (select x.id from public.escalation_rules x where x.id = (opt ->> 'rule_id')::bigint), opt ->> 'text', due_at);
      update public.escalation_polls
         set status = 'entschieden', winner_option = win, winner_votes = win_votes, total_votes = total
       where id = p.id;

      perform public.escalation_open_poll(p_session, have + 2, due_at, due_at + make_interval(secs => s.interval_s));
    else
      r := public.escalation_pick_rule(p_session);
      if r.id is null then
        update public.escalation_sessions set pool_exhausted = true where id = p_session and not pool_exhausted;
        exit;
      end if;
      have := have + 1;
      insert into public.escalation_session_rules (session_id, position, rule_id, text, added_at)
      values (p_session, have + 1, r.id, r.text, due_at);
    end if;
  end loop;
  return have + 1;
end;
$$;

-- Beenden: nicht-offizielle Runden (kein Admin dabei) werden gelöscht, nicht gespeichert
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

  if not s.official then
    delete from public.escalation_sessions where id = p_session;
    return;
  end if;

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

-- ---------- Winchallenge ----------
alter table public.win_challenges
  add column official boolean not null default true,
  add column replay_of bigint references public.win_challenges (id) on delete set null;
create index win_challenges_replay_idx on public.win_challenges (replay_of);

-- Wer die Winchallenge steuern darf: Admins und der Host (Zuschauer bei ihrer Nachspiel-Runde)
create or replace function public.win_can_control(p_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (select 1 from public.win_challenges where id = p_id and host_id = auth.uid());
$$;

create policy "host insert" on public.win_challenge_games for insert to authenticated
  with check (exists (select 1 from public.win_challenges w where w.id = win_challenge_games.challenge_id and w.host_id = (select auth.uid()) and w.status <> 'beendet'));
create policy "host update" on public.win_challenge_games for update to authenticated
  using (exists (select 1 from public.win_challenges w where w.id = win_challenge_games.challenge_id and w.host_id = (select auth.uid()) and w.status <> 'beendet'));
create policy "host delete" on public.win_challenge_games for delete to authenticated
  using (exists (select 1 from public.win_challenges w where w.id = win_challenge_games.challenge_id and w.host_id = (select auth.uid()) and w.status <> 'beendet'));

create or replace function public.win_timer(p_id bigint, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.win_challenges;
begin
  if not public.win_can_control(p_id) then raise exception 'Nur der Host steuert die Winchallenge'; end if;
  select * into w from public.win_challenges where id = p_id for update;
  if w.id is null then raise exception 'Winchallenge nicht gefunden'; end if;
  if w.status = 'beendet' then raise exception 'Die Winchallenge ist beendet'; end if;
  if p_action = 'start' then
    if w.status <> 'laeuft' then
      update public.win_challenges set status = 'laeuft', started_at = now() where id = p_id;
    end if;
  elsif p_action = 'pause' then
    if w.status = 'laeuft' then
      update public.win_challenges
         set status = 'pausiert', elapsed_s = elapsed_s + extract(epoch from now() - started_at), started_at = null
       where id = p_id;
    end if;
  elsif p_action = 'reset' then
    update public.win_challenges set status = 'bereit', elapsed_s = 0, started_at = null where id = p_id;
  else
    raise exception 'Unbekannte Aktion';
  end if;
end;
$$;

create or replace function public.win_add(p_game bigint, p_delta int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.win_challenges;
  n int;
begin
  select wc.* into w from public.win_challenges wc join public.win_challenge_games g on g.challenge_id = wc.id where g.id = p_game;
  if w.id is null then raise exception 'Spiel nicht gefunden'; end if;
  if not public.win_can_control(w.id) then raise exception 'Nur der Host zählt Siege'; end if;
  if w.status = 'beendet' then raise exception 'Die Winchallenge ist beendet'; end if;
  update public.win_challenge_games
     set wins = greatest(0, least(999, wins + coalesce(p_delta, 0)))
   where id = p_game
  returning wins into n;
  return n;
end;
$$;

-- Beenden und werten. Nicht-offizielle Winchallenges werden gelöscht (Rückgabe 'geloescht').
create or replace function public.win_finish(p_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.win_challenges;
  res text;
  ch bigint;
  games jsonb;
  used numeric;
begin
  if not public.win_can_control(p_id) then raise exception 'Nur der Host beendet die Winchallenge'; end if;
  select * into w from public.win_challenges where id = p_id for update;
  if w.id is null then raise exception 'Winchallenge nicht gefunden'; end if;
  if w.status = 'beendet' then return w.result; end if;

  if not w.official then
    delete from public.win_challenges where id = p_id;
    return 'geloescht';
  end if;

  used := w.elapsed_s + case when w.status = 'laeuft' then extract(epoch from now() - w.started_at) else 0 end;
  if w.duration_s > 0 then used := least(used, w.duration_s); end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'wins', wins, 'target', target) order by position, id), '[]'::jsonb)
    into games from public.win_challenge_games where challenge_id = p_id;
  res := case
    when jsonb_array_length(games) > 0
     and not exists (select 1 from public.win_challenge_games where challenge_id = p_id and wins < target)
    then 'geschafft' else 'gescheitert' end;

  insert into public.challenges (title, source, status, played_at, config)
  values (
    'Winchallenge' || coalesce(': ' || w.title, ''), 'winchallenge', res, coalesce(w.created_at, now()),
    jsonb_build_object('win_challenge_id', w.id, 'games', games, 'duration_s', w.duration_s, 'used_s', round(used))
  )
  returning id into ch;

  update public.win_challenges
     set status = 'beendet', result = res, challenge_id = ch, ended_at = now(), elapsed_s = used, started_at = null
   where id = p_id;
  return res;
end;
$$;

-- Nachspielen: gleiche Spiele, gleiche Ziel-Siege, gleicher Timer – Siege bei 0
create or replace function public.win_replay(p_source bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  src public.win_challenges;
  new_id bigint;
begin
  if auth.uid() is null then raise exception 'Zum Nachspielen mit Twitch einloggen'; end if;
  select * into src from public.win_challenges where id = p_source;
  if src.id is null or src.status <> 'beendet' or not src.official then raise exception 'Diese Winchallenge kann nicht nachgespielt werden'; end if;

  delete from public.win_challenges where not official and status <> 'beendet' and created_at < now() - interval '2 days';

  insert into public.win_challenges (title, duration_s, official, replay_of)
  values ('Nachgespielt: ' || coalesce(src.title, 'Winchallenge #' || src.id), src.duration_s, public.is_admin(), src.id)
  returning id into new_id;
  insert into public.win_challenge_games (challenge_id, position, name, target)
  select new_id, position, name, target from public.win_challenge_games where challenge_id = p_source;
  return new_id;
end;
$$;

-- Zuschauer dürfen die Winchallenge-Zeile selbst nicht anlegen (nur über win_replay)
revoke execute on function public.win_can_control(bigint) from public, anon;
grant execute on function public.win_can_control(bigint) to authenticated;
revoke execute on function public.escalation_replay(bigint) from public, anon;
revoke execute on function public.win_replay(bigint) from public, anon;
grant execute on function public.escalation_replay(bigint) to authenticated;
grant execute on function public.win_replay(bigint) to authenticated;
