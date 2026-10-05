-- ============================================================================
-- Live-Datenbank nachziehen (einmalig im Supabase SQL-Editor ausführen)
-- Komplett kopieren → im SQL-Editor einfügen → Run.
-- Enthält in dieser Reihenfolge:
--   1. Regel-Eskalation: Mitspieler, Ende-Button, Sieger
--   2. Regel-Eskalation: Chat-Abstimmung
--   3. Aufräumen: leere Beschreibungs-Spalten der Items
--   4. Aufräumen: Tabellen von Community-Voting und Versus
-- Läuft als eine Transaktion: Bei einem Fehler wird nichts geändert.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 20261004001200_escalation_players_winner.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 20261004001300_escalation_chat_vote.sql
-- ---------------------------------------------------------------------------
-- Regel-Eskalation, Spezialmodus „Chat-Abstimmung“: Statt Zufall stimmt Alvis Twitch-Chat über die
-- nächste Regel ab (3 Optionen, !1/!2/!3). Die Chat-Brücke im Browser des Hosts postet die Abstimmung
-- und trägt Stimmen ein; Auswertung und Zeitpunkte bestimmt weiterhin die Datenbank (escalation_tick).

alter table public.escalation_sessions
  add column mode text not null default 'zufall' check (mode in ('zufall', 'chat')),
  add column twitch_channel text check (twitch_channel ~ '^[a-z0-9_]{3,25}$');

create table public.escalation_polls (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.escalation_sessions (id) on delete cascade,
  position int not null,                -- Regel-Position, über die abgestimmt wird
  options jsonb not null,               -- [{ "rule_id": 1, "text": "…" }, …] (1–3 Optionen)
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'offen' check (status in ('offen', 'entschieden')),
  winner_option int,
  winner_votes int,
  total_votes int,
  announced_at timestamptz,             -- Abstimmung im Chat gepostet
  result_announced_at timestamptz,      -- Ergebnis im Chat gepostet
  unique (session_id, position)
);

create table public.escalation_votes (
  poll_id bigint not null references public.escalation_polls (id) on delete cascade,
  voter text not null,                  -- Twitch-Login (klein), eine Stimme pro Zuschauer, die letzte zählt
  option int not null check (option between 1 and 3),
  voted_at timestamptz not null default now(),
  primary key (poll_id, voter)
);

create view public.escalation_poll_counts
with (security_invoker = true) as
select poll_id, option, count(*)::int as votes
from public.escalation_votes
group by poll_id, option;

alter table public.escalation_polls enable row level security;
alter table public.escalation_votes enable row level security;
create policy "lesen" on public.escalation_polls for select using (true);
create policy "lesen" on public.escalation_votes for select using (true);

-- Neue Abstimmung mit bis zu 3 zufälligen, in dieser Runde noch nicht gezogenen Regeln
create or replace function public.escalation_open_poll(p_session bigint, p_position int, p_opens timestamptz, p_closes timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  opts jsonb;
begin
  select jsonb_agg(jsonb_build_object('rule_id', x.id, 'text', x.text)) into opts
  from (
    select r.id, r.text from public.escalation_rules r
    where r.active
      and r.id not in (
        select sr.rule_id from public.escalation_session_rules sr
        where sr.session_id = p_session and sr.rule_id is not null
      )
    order by random()
    limit 3
  ) x;
  if opts is null then
    update public.escalation_sessions set pool_exhausted = true where id = p_session and not pool_exhausted;
    return false;
  end if;
  insert into public.escalation_polls (session_id, position, options, opens_at, closes_at)
  values (p_session, p_position, opts, p_opens, p_closes)
  on conflict (session_id, position) do nothing;
  return true;
end;
$$;

create or replace function public.escalation_start(p_session bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.escalation_sessions;
begin
  select * into s from public.escalation_sessions where id = p_session for update;
  if s.host_id is distinct from auth.uid() then raise exception 'Nur wer die Runde eröffnet hat, darf starten'; end if;
  if s.status <> 'bereit' then raise exception 'Die Runde läuft schon'; end if;
  if not exists (select 1 from public.escalation_session_rules where session_id = p_session) then
    raise exception 'Zuerst die Grundregel drehen';
  end if;
  update public.escalation_sessions set status = 'laeuft', started_at = now() where id = p_session;
  if s.mode = 'chat' then
    perform public.escalation_open_poll(p_session, 2, now(), now() + make_interval(secs => s.interval_s));
  end if;
end;
$$;

-- Fällige Regeln nachziehen (idempotent, von jedem Bildschirm aufrufbar).
-- Zufallsmodus: zufällige Regel. Chat-Modus: Gewinner der Abstimmung, danach öffnet die nächste.
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

    if s.mode = 'chat' then
      select * into p from public.escalation_polls where session_id = p_session and position = have + 2;
      if p.id is null then
        -- Keine Abstimmung offen (z. B. Pool war leer) → nochmal versuchen, sonst Ende
        exit when not public.escalation_open_poll(p_session, have + 2, due_at - make_interval(secs => s.interval_s), due_at);
        select * into p from public.escalation_polls where session_id = p_session and position = have + 2;
      end if;

      select coalesce(sum(votes), 0)::int into total from public.escalation_poll_counts where poll_id = p.id;
      -- Meiste Stimmen gewinnt; Gleichstand → Los; keine Stimmen → zufällige Option
      select o.n, coalesce(c.votes, 0) into win, win_votes
      from generate_series(1, jsonb_array_length(p.options)) o(n)
      left join public.escalation_poll_counts c on c.poll_id = p.id and c.option = o.n
      order by coalesce(c.votes, 0) desc, random()
      limit 1;
      opt := p.options -> (win - 1);

      have := have + 1;
      insert into public.escalation_session_rules (session_id, position, rule_id, text, added_at)
      -- Regel kann inzwischen aus dem Pool gelöscht sein → Text behalten, Verweis weglassen
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

-- Stimme aus dem Twitch-Chat eintragen (nur die Chat-Brücke des Hosts)
create or replace function public.escalation_poll_vote(p_poll bigint, p_voter text, p_option int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.escalation_polls;
  s public.escalation_sessions;
begin
  select * into p from public.escalation_polls where id = p_poll;
  if p.id is null then return false; end if;
  select * into s from public.escalation_sessions where id = p.session_id;
  if s.host_id is distinct from auth.uid() then raise exception 'Nur die Chat-Brücke des Hosts darf Stimmen eintragen'; end if;
  if p.status <> 'offen' or s.status <> 'laeuft' or now() > p.closes_at + interval '2 seconds' then return false; end if;
  if p_option < 1 or p_option > jsonb_array_length(p.options) then return false; end if;
  if p_voter !~ '^[a-z0-9_]{1,25}$' then return false; end if;
  insert into public.escalation_votes (poll_id, voter, option) values (p_poll, p_voter, p_option)
  on conflict (poll_id, voter) do update set option = excluded.option, voted_at = now();
  return true;
end;
$$;

-- Markiert Abstimmung/Ergebnis als gepostet. Liefert true nur beim ersten Aufruf → kein doppeltes Posten.
create or replace function public.escalation_poll_mark(p_poll bigint, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.escalation_sessions;
  n int;
begin
  select es.* into s from public.escalation_sessions es join public.escalation_polls p on p.session_id = es.id where p.id = p_poll;
  if s.host_id is distinct from auth.uid() then raise exception 'Nur der Host'; end if;
  if p_kind = 'announced' then
    update public.escalation_polls set announced_at = now() where id = p_poll and announced_at is null;
  elsif p_kind = 'result' then
    update public.escalation_polls set result_announced_at = now() where id = p_poll and result_announced_at is null and status = 'entschieden';
  else
    raise exception 'Unbekannte Markierung';
  end if;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Eröffnen mit Modus und Twitch-Kanal (Host ist automatisch Mitspieler)
create or replace function public.escalation_create(p_title text, p_interval_s int, p_mode text, p_channel text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
  chan text := lower(nullif(trim(p_channel), ''));
begin
  if not public.is_admin() then raise exception 'Nur Admins können eine Regel-Eskalation eröffnen'; end if;
  if not exists (select 1 from public.escalation_rules where active) then
    raise exception 'Der Regelpool ist leer – zuerst Regeln im Admin-Bereich anlegen';
  end if;
  if p_mode not in ('zufall', 'chat') then raise exception 'Unbekannter Modus'; end if;
  if p_mode = 'chat' then
    chan := coalesce(chan, (select value from public.site_settings where key = 'main_creator_login'));
    if chan is null or chan !~ '^[a-z0-9_]{3,25}$' then raise exception 'Ungültiger Twitch-Kanal'; end if;
  else
    chan := null;
  end if;
  insert into public.escalation_sessions (title, interval_s, mode, twitch_channel)
  values (nullif(trim(p_title), ''), greatest(30, least(3600, coalesce(p_interval_s, 240))), p_mode, chan)
  returning id into new_id;
  perform public.escalation_join(new_id);
  return new_id;
end;
$$;

revoke execute on function public.escalation_open_poll(bigint, int, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.escalation_poll_vote(bigint, text, int) from public, anon;
revoke execute on function public.escalation_poll_mark(bigint, text) from public, anon;
revoke execute on function public.escalation_create(text, int, text, text) from public, anon;
grant execute on function public.escalation_poll_vote(bigint, text, int) to authenticated;
grant execute on function public.escalation_poll_mark(bigint, text) to authenticated;
grant execute on function public.escalation_create(text, int, text, text) to authenticated;
-- Alte 2-Parameter-Variante wird nicht mehr benutzt
revoke execute on function public.escalation_create(text, int) from public, anon, authenticated;

alter publication supabase_realtime add table public.escalation_polls, public.escalation_votes;

-- ---------------------------------------------------------------------------
-- 20261004000700_drop_item_description_columns.sql
-- ---------------------------------------------------------------------------
-- Entfernt die (leeren) Beschreibungs-Spalten.
-- Noch NICHT im Live-Projekt angewendet: im Supabase SQL-Editor ausführen.
alter table public.auction_rounds drop column item_description;
alter table public.loot_items drop column description;

-- ---------------------------------------------------------------------------
-- 20261004001000_remove_voting_versus.sql
-- ---------------------------------------------------------------------------
-- Community-Voting und Versus-Scoreboard entfernt (inkl. Realtime-Publikation, Views, Funktionen).

drop view if exists public.submission_scores;
drop table if exists public.votes;
drop table if exists public.submissions;
drop function if exists public.submissions_this_week(uuid);
drop function if exists public.set_submission_week();
drop function if exists public.current_week();

drop table if exists public.versus_checklist;
drop table if exists public.versus_matches;
-- Die erlaubten Challenge-Quellen setzt 20261004001100_escalation.sql (ohne voting/versus).

commit;
