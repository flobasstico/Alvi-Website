-- Regel-Eskalation: Grundregel per Glücksrad, danach alle X Minuten eine zusätzliche Zufallsregel.
-- Auswahl und Zeitpunkte bestimmt die Datenbank; alle Bildschirme/OBS-Overlays zeigen denselben Stand.

-- Regelpool (startet leer, Pflege durch Admins)
create table public.escalation_rules (
  id bigint generated always as identity primary key,
  text text not null check (char_length(text) between 1 and 200),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.escalation_sessions (
  id bigint generated always as identity primary key,
  host_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text,
  interval_s int not null default 240 check (interval_s between 30 and 3600),
  status text not null default 'bereit' check (status in ('bereit', 'laeuft', 'beendet')),
  started_at timestamptz,
  ended_at timestamptz,
  result text check (result in ('geschafft', 'gescheitert')),
  pool_exhausted boolean not null default false,
  challenge_id bigint references public.challenges (id) on delete set null,
  created_at timestamptz not null default now()
);
create index escalation_sessions_host_idx on public.escalation_sessions (host_id);
create index escalation_sessions_challenge_idx on public.escalation_sessions (challenge_id);

-- Gezogene Regeln einer Runde (Position 1 = Grundregel); Text als Kopie, falls der Pool später geändert wird
create table public.escalation_session_rules (
  session_id bigint not null references public.escalation_sessions (id) on delete cascade,
  position int not null check (position >= 1),
  rule_id bigint references public.escalation_rules (id) on delete set null,
  text text not null,
  added_at timestamptz not null default now(),
  primary key (session_id, position)
);
create index escalation_session_rules_rule_idx on public.escalation_session_rules (rule_id);

-- Challenge-Quelle ergänzen
alter table public.challenges drop constraint challenges_source_check;
alter table public.challenges add constraint challenges_source_check
  check (source in ('rad', 'loadout', 'drop', 'bingo', 'auktion', 'eskalation', 'manuell'));

-- ---------- Logik ----------

-- Zufällige, in dieser Runde noch nicht gezogene Regel
create or replace function public.escalation_pick_rule(p_session bigint)
returns public.escalation_rules
language sql
volatile
security definer
set search_path = ''
as $$
  select r.*
  from public.escalation_rules r
  where r.active
    and r.id not in (
      select sr.rule_id from public.escalation_session_rules sr
      where sr.session_id = p_session and sr.rule_id is not null
    )
  order by random()
  limit 1;
$$;

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
  return new_id;
end;
$$;

-- Grundregel per Glücksrad (nur Host, nur einmal)
create or replace function public.escalation_draw_base(p_session bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.escalation_sessions;
  r public.escalation_rules;
begin
  select * into s from public.escalation_sessions where id = p_session for update;
  if s.id is null then raise exception 'Runde nicht gefunden'; end if;
  if s.host_id is distinct from auth.uid() then raise exception 'Nur wer die Runde eröffnet hat, darf drehen'; end if;
  if exists (select 1 from public.escalation_session_rules where session_id = p_session) then
    raise exception 'Die Grundregel steht schon fest';
  end if;
  r := public.escalation_pick_rule(p_session);
  if r.id is null then raise exception 'Der Regelpool ist leer'; end if;
  insert into public.escalation_session_rules (session_id, position, rule_id, text) values (p_session, 1, r.id, r.text);
  return r.id;
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
end;
$$;

-- Fällige Regeln nachziehen. Idempotent und von jedem Bildschirm aufrufbar (auch OBS ohne Login):
-- Regel k (k ≥ 1) ist fällig ab started_at + k × Intervall.
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
begin
  select * into s from public.escalation_sessions where id = p_session for update;
  if s.id is null or s.status <> 'laeuft' then
    return (select count(*) from public.escalation_session_rules where session_id = p_session);
  end if;
  due := floor(extract(epoch from (now() - s.started_at)) / s.interval_s)::int;
  select count(*) - 1 into have from public.escalation_session_rules where session_id = p_session;
  while have < due loop
    r := public.escalation_pick_rule(p_session);
    if r.id is null then
      update public.escalation_sessions set pool_exhausted = true where id = p_session and not pool_exhausted;
      exit;
    end if;
    have := have + 1;
    insert into public.escalation_session_rules (session_id, position, rule_id, text, added_at)
    values (p_session, have + 1, r.id, r.text, s.started_at + make_interval(secs => have * s.interval_s));
  end loop;
  return have + 1;
end;
$$;

-- Runde beenden; mit Ergebnis landet sie als Challenge in den Stats
create or replace function public.escalation_stop(p_session bigint, p_result text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.escalation_sessions;
  ch bigint;
  rules jsonb;
begin
  perform public.escalation_tick(p_session);
  select * into s from public.escalation_sessions where id = p_session for update;
  if s.host_id is distinct from auth.uid() then raise exception 'Nur wer die Runde eröffnet hat, darf beenden'; end if;
  if s.status = 'beendet' then raise exception 'Die Runde ist schon beendet'; end if;
  if p_result is not null and p_result not in ('geschafft', 'gescheitert') then raise exception 'Ungültiges Ergebnis'; end if;

  if p_result is not null then
    select coalesce(jsonb_agg(text order by position), '[]'::jsonb) into rules
    from public.escalation_session_rules where session_id = p_session;
    insert into public.challenges (title, source, status, played_at, config)
    values (
      'Regel-Eskalation' || coalesce(': ' || s.title, '') || ' (' || jsonb_array_length(rules) || ' Regeln)',
      'eskalation', p_result, coalesce(s.started_at, now()),
      jsonb_build_object('session_id', s.id, 'rules', rules, 'interval_s', s.interval_s)
    )
    returning id into ch;
  end if;

  update public.escalation_sessions
     set status = 'beendet', ended_at = now(), result = p_result, challenge_id = ch
   where id = p_session;
end;
$$;

revoke execute on function public.escalation_pick_rule(bigint) from public, anon, authenticated;
revoke execute on function public.escalation_create(text, int) from public, anon;
revoke execute on function public.escalation_draw_base(bigint) from public, anon;
revoke execute on function public.escalation_start(bigint) from public, anon;
revoke execute on function public.escalation_stop(bigint, text) from public, anon;
grant execute on function public.escalation_create(text, int) to authenticated;
grant execute on function public.escalation_draw_base(bigint) to authenticated;
grant execute on function public.escalation_start(bigint) to authenticated;
grant execute on function public.escalation_stop(bigint, text) to authenticated;
-- Tick dürfen alle (OBS-Overlay ist nicht eingeloggt); er fügt nur fällige Regeln hinzu
grant execute on function public.escalation_tick(bigint) to anon, authenticated;

-- ---------- RLS ----------
alter table public.escalation_rules enable row level security;
alter table public.escalation_sessions enable row level security;
alter table public.escalation_session_rules enable row level security;

create policy "lesen" on public.escalation_rules for select using (true);
create policy "lesen" on public.escalation_sessions for select using (true);
create policy "lesen" on public.escalation_session_rules for select using (true);

create policy "admin insert" on public.escalation_rules for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.escalation_rules for update to authenticated using ((select public.is_admin()));
create policy "admin delete" on public.escalation_rules for delete to authenticated using ((select public.is_admin()));
create policy "admin delete" on public.escalation_sessions for delete to authenticated using ((select public.is_admin()));

alter publication supabase_realtime add table public.escalation_sessions, public.escalation_session_rules;
