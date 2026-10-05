-- Regel-Eskalation: getrennte Pools für Grundregeln (Glücksrad zum Start) und Zusatzregeln (alle X Minuten).
-- Bestehende Regeln werden Zusatzregeln.

alter table public.escalation_rules
  add column kind text not null default 'zusatz' check (kind in ('grund', 'zusatz'));

-- Zufällige, in dieser Runde noch nicht gezogene Zusatzregel
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
    and r.kind = 'zusatz'
    and r.id not in (
      select sr.rule_id from public.escalation_session_rules sr
      where sr.session_id = p_session and sr.rule_id is not null
    )
  order by random()
  limit 1;
$$;

-- Grundregel per Glücksrad aus dem Grundregel-Pool (nur Host, nur einmal)
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
  select * into r from public.escalation_rules where active and kind = 'grund' order by random() limit 1;
  if r.id is null then raise exception 'Der Grundregel-Pool ist leer'; end if;
  insert into public.escalation_session_rules (session_id, position, rule_id, text) values (p_session, 1, r.id, r.text);
  return r.id;
end;
$$;

-- Abstimmungs-Optionen nur aus den Zusatzregeln
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
      and r.kind = 'zusatz'
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

-- Eröffnen: beide Pools brauchen mindestens eine aktive Regel
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
  if not exists (select 1 from public.escalation_rules where active and kind = 'grund') then
    raise exception 'Der Grundregel-Pool ist leer – zuerst Grundregeln im Admin-Bereich anlegen';
  end if;
  if not exists (select 1 from public.escalation_rules where active and kind = 'zusatz') then
    raise exception 'Der Zusatzregel-Pool ist leer – zuerst Zusatzregeln im Admin-Bereich anlegen';
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
