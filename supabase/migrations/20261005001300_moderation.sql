-- Moderation für den öffentlichen Betrieb:
-- 1) Sperren: Admins können Twitch-Accounts sperren. Gesperrte können nichts mehr anlegen, beitreten, abhaken …
--    (zentral per PostgREST-Pre-Request: jede schreibende API-Anfrage wird abgelehnt; lesen geht weiter).
-- 2) Bingo-Karten von Zuschauern brauchen eine Freigabe durch einen Admin, bevor alle sie sehen.
-- 3) Höchstens 5 neue Karten pro Person und Tag (Admins unbegrenzt).
-- 4) Nicht beendete Runden ohne Admin werden automatisch gelöscht: Olympiade nach 4 Tagen, alle anderen nach 2 Tagen.

-- ---------- 1) Sperren ----------
alter table public.profiles add column banned boolean not null default false;

create or replace function public.check_request()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.method', true), 'GET') not in ('GET', 'HEAD', 'OPTIONS')
     and auth.uid() is not null
     and exists (select 1 from public.profiles where id = auth.uid() and banned) then
    raise exception 'Dein Account ist gesperrt' using errcode = '42501';
  end if;
end;
$$;
grant execute on function public.check_request() to anon, authenticated;

alter role authenticator set pgrst.db_pre_request = 'public.check_request';
notify pgrst, 'reload config';

create or replace function public.admin_set_banned(p_user uuid, p_banned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Nur Admins können sperren'; end if;
  if exists (select 1 from public.profiles where id = p_user and role = 'admin') then
    raise exception 'Admins können nicht gesperrt werden';
  end if;
  update public.profiles set banned = coalesce(p_banned, false) where id = p_user;
  if not found then raise exception 'Nutzer nicht gefunden'; end if;
  -- Nicht freigegebene Karten gesperrter Nutzer verschwinden gleich mit
  if p_banned then
    delete from public.bingo_card_templates where author_id = p_user and not approved;
  end if;
end;
$$;
revoke execute on function public.admin_set_banned(uuid, boolean) from public, anon;
grant execute on function public.admin_set_banned(uuid, boolean) to authenticated;

-- ---------- 2) Freigabe von Bingo-Karten ----------
alter table public.bingo_card_templates add column approved boolean not null default false;
update public.bingo_card_templates set approved = true;   -- bestehende Karten bleiben sichtbar

drop policy "lesen" on public.bingo_card_templates;
create policy "lesen" on public.bingo_card_templates for select
  using (
    approved
    or author_id = (select auth.uid())
    -- ohne is_admin(): die Funktion dürfen Gäste nicht ausführen
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

create or replace function public.admin_approve_card(p_card bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Nur Admins geben Karten frei'; end if;
  update public.bingo_card_templates set approved = true where id = p_card;
  if not found then raise exception 'Karte nicht gefunden'; end if;
end;
$$;
revoke execute on function public.admin_approve_card(bigint) from public, anon;
grant execute on function public.admin_approve_card(bigint) to authenticated;

-- ---------- 3) Karte erstellen: Limit + Freigabe ----------
create or replace function public.bingo_card_create(p_title text, p_tasks text[])
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text[];
  prof public.profiles;
  new_id bigint;
begin
  if auth.uid() is null then raise exception 'Zum Erstellen mit Twitch einloggen'; end if;
  select * into prof from public.profiles where id = auth.uid();
  if prof.role is distinct from 'admin'
     and (select count(*) from public.bingo_card_templates where author_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Maximal 5 neue Karten pro Tag – morgen geht es weiter';
  end if;
  select array_agg(left(trim(t), 80) order by n) into cleaned from unnest(p_tasks) with ordinality u(t, n);
  if coalesce(cardinality(cleaned), 0) <> 9 or exists (select 1 from unnest(cleaned) t where t = '') then
    raise exception 'Bitte alle 9 Felder ausfüllen';
  end if;
  if (select count(distinct lower(t)) from unnest(cleaned) t) <> 9 then raise exception 'Jede Aufgabe nur einmal'; end if;
  if nullif(trim(p_title), '') is null then raise exception 'Bitte einen Namen für die Karte eingeben'; end if;
  insert into public.bingo_card_templates (title, author_name, tasks, folder, approved)
  values (
    left(trim(p_title), 60), coalesce(prof.display_name, prof.twitch_login), cleaned,
    case when prof.role = 'admin' then 'admin' else 'zuschauer' end,
    prof.role = 'admin'
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- ---------- 4) Aufräumen nicht beendeter Runden ohne Admin ----------
create or replace function public.cleanup_stale_rounds()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.escalation_sessions where not official and status <> 'beendet' and created_at < now() - interval '2 days';
  delete from public.win_challenges where not official and status <> 'beendet' and created_at < now() - interval '2 days';
  delete from public.bingo_rounds where not official and status <> 'beendet' and created_at < now() - interval '2 days';
  delete from public.olympics where not official and status <> 'beendet' and created_at < now() - interval '4 days';
end;
$$;
revoke execute on function public.cleanup_stale_rounds() from public, anon, authenticated;

-- Bei jeder neu angelegten Runde (egal welches Spiel) wird aufgeräumt
create or replace function public.cleanup_stale_rounds_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.cleanup_stale_rounds();
  return null;
end;
$$;
revoke execute on function public.cleanup_stale_rounds_trigger() from public, anon, authenticated;
create trigger cleanup_stale after insert on public.escalation_sessions for each statement execute function public.cleanup_stale_rounds_trigger();
create trigger cleanup_stale after insert on public.win_challenges for each statement execute function public.cleanup_stale_rounds_trigger();
create trigger cleanup_stale after insert on public.bingo_rounds for each statement execute function public.cleanup_stale_rounds_trigger();
create trigger cleanup_stale after insert on public.olympics for each statement execute function public.cleanup_stale_rounds_trigger();

-- Runde mit Karte eröffnen: nur freigegebene, eigene oder als Admin; Aufräumen übernimmt der Trigger
create or replace function public.bingo_round_create(p_template bigint, p_title text, p_max_players int)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.bingo_card_templates;
  new_id bigint;
begin
  if auth.uid() is null then raise exception 'Zum Spielen mit Twitch einloggen'; end if;
  select * into t from public.bingo_card_templates where id = p_template;
  if t.id is null or not (t.approved or t.author_id = auth.uid() or public.is_admin()) then
    raise exception 'Karte nicht gefunden';
  end if;
  insert into public.bingo_rounds (title, template_id, tasks, max_players, official)
  values (coalesce(nullif(trim(p_title), ''), t.title), t.id, t.tasks, greatest(2, least(8, coalesce(p_max_players, 4))), public.is_admin())
  returning id into new_id;
  perform public.bingo_join(new_id);
  return new_id;
end;
$$;

-- Olympiade eröffnen: wie bisher, Aufräumen (nach 4 Tagen) übernimmt der Trigger
create or replace function public.olympic_create(p_title text, p_games text[], p_max_players int)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
  names text[];
begin
  if auth.uid() is null then raise exception 'Zum Spielen mit Twitch einloggen'; end if;
  select array_agg(n order by i) into names from (
    select distinct on (lower(left(trim(t), 60))) left(trim(t), 60) n, i
      from unnest(p_games) with ordinality u(t, i)
     where trim(t) <> ''
     order by lower(left(trim(t), 60)), i
  ) x;
  if coalesce(cardinality(names), 0) < 2 then raise exception 'Mindestens 2 Spiele eintragen'; end if;
  if cardinality(names) > 40 then raise exception 'Höchstens 40 Spiele'; end if;
  insert into public.olympics (title, max_players, official)
  values (nullif(left(trim(coalesce(p_title, '')), 80), ''), greatest(2, least(8, coalesce(p_max_players, 8))), public.is_admin())
  returning id into new_id;
  insert into public.olympic_games (olympic_id, name) select new_id, n from unnest(names) n;
  perform public.olympic_join(new_id);
  return new_id;
end;
$$;
