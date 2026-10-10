-- Absicherungen aus der Kontrollanalyse (Okt. 2026)

-- ---------- 1) Neue Runden: Limit pro Person, Titel kürzen, Zeitstempel erzwingen ----------
-- Gilt für alle Mehrspieler-Spiele, egal ob über die Seite oder direkt per API angelegt.
-- Admins sind ausgenommen. Die Auktion bekommt zusätzlich Plausibilitätsprüfungen.
create or replace function public.guard_round_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  new.created_at := now();
  new.title := left(btrim(new.title), 80);
  if uid is not null and not public.is_admin() then
    select (select count(*) from public.auctions where host_id = uid and created_at > now() - interval '1 day')
         + (select count(*) from public.escalation_sessions where host_id = uid and created_at > now() - interval '1 day')
         + (select count(*) from public.loadout_sessions where host_id = uid and created_at > now() - interval '1 day')
         + (select count(*) from public.bingo_rounds where host_id = uid and created_at > now() - interval '1 day')
         + (select count(*) from public.olympics where host_id = uid and created_at > now() - interval '1 day')
         + (select count(*) from public.win_challenges where host_id = uid and created_at > now() - interval '1 day')
      into n;
    if n >= 30 then
      raise exception 'Tageslimit erreicht: höchstens 30 neue Runden pro Tag' using errcode = '42501';
    end if;
  end if;
  if tg_table_name = 'auctions' then
    if new.bid_step is null or new.bid_step < 1 or new.bid_step > 1000 then
      raise exception 'Ungültige Gebotsschritte';
    end if;
    if new.rarities is not null and not (new.rarities <@ array['grau', 'gruen', 'blau', 'lila', 'gold', 'mythisch']::text[]) then
      raise exception 'Ungültige Seltenheiten';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_round_insert() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['auctions', 'escalation_sessions', 'loadout_sessions', 'bingo_rounds', 'olympics', 'win_challenges'] loop
    execute format('drop trigger if exists guard_round_insert on public.%I', t);
    -- Name beginnt mit „guard“, läuft also vor „set_auction_official“ (Trigger laufen alphabetisch)
    execute format('create trigger guard_round_insert before insert on public.%I for each row execute function public.guard_round_insert()', t);
  end loop;
end $$;

-- ---------- 2) Zuschauer-Runden: höchstens 20 gewertete Runden pro Spieler und Tag ----------
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
     -- Schutz gegen massenhaft gesammelte Siege: ab der 21. Runde am Tag wird nichts mehr gespeichert (Admins ausgenommen)
     and (
       exists (select 1 from public.profiles pr where pr.id = (p->>'user_id')::uuid and pr.role = 'admin')
       or (select count(*) from public.viewer_round_players vp
             join public.viewer_rounds vr on vr.id = vp.round_id
            where vp.user_id = (p->>'user_id')::uuid and vr.id <> rid and vr.played_at > now() - interval '1 day') < 20
     )
  on conflict do nothing;
  -- Runde ohne gespeicherte Spieler wieder entfernen
  delete from public.viewer_rounds where id = rid and not exists (select 1 from public.viewer_round_players where round_id = rid);
end;
$$;
revoke all on function public.record_viewer_round(text, timestamptz, jsonb) from public, anon, authenticated;

-- ---------- 3) Sturm-Lauf: Wertung zählt höchstens 10 Minuten Spieldauer ----------
create or replace function public.minigame_submit(p_run bigint, p_score integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.minigame_runs;
  secs numeric;
  best int;
begin
  select * into r from public.minigame_runs where id = p_run for update;
  if r.id is null or r.user_id is distinct from auth.uid() then raise exception 'Runde nicht gefunden'; end if;
  if r.score is not null then raise exception 'Diese Runde ist schon gewertet'; end if;
  if p_score is null or p_score < 0 then raise exception 'Ungültige Punktzahl'; end if;
  secs := extract(epoch from now() - r.started_at);
  if secs > 3600 then raise exception 'Die Runde ist abgelaufen'; end if;
  if r.game = 'dropzone' then
    -- 3 Sprünge à mind. ~3 s, höchstens 150 Punkte pro Sprung
    if secs < 8 or p_score > 450 then raise exception 'Ergebnis nicht plausibel'; end if;
  else
    -- Sturm-Lauf: höchstens ~100 Punkte pro Sekunde, gezählt werden höchstens 10 Minuten
    if secs < 2 or p_score > least(secs, 600) * 100 + 50 then raise exception 'Ergebnis nicht plausibel'; end if;
  end if;
  select max(score) into best from public.minigame_runs where user_id = r.user_id and game = r.game and score is not null;
  update public.minigame_runs set score = p_score, finished_at = now() where id = p_run;
  return best is null or p_score > best;
end;
$$;

-- ---------- 4) Bewertungen der Vorschläge nicht mehr mit Namen lesbar ----------
-- Jeder sieht nur noch seine eigenen Stimmen; die Summen kommen über suggestion_counts().
drop policy if exists "Stimmen lesen" on public.suggestion_votes;
drop policy if exists "Eigene Stimmen lesen" on public.suggestion_votes;
create policy "Eigene Stimmen lesen" on public.suggestion_votes for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.suggestion_counts(p_ids bigint[] default null)
returns table (suggestion_id bigint, likes int, dislikes int)
language sql
stable
security definer
set search_path = ''
as $$
  select v.suggestion_id, count(*) filter (where v.value = 1)::int, count(*) filter (where v.value = -1)::int
    from public.suggestion_votes v
   where p_ids is null or v.suggestion_id = any (p_ids)
   group by v.suggestion_id;
$$;
grant execute on function public.suggestion_counts(bigint[]) to anon, authenticated;

-- ---------- 5) Twitch-Name eindeutig (ein frei gewordener Name kann nicht doppelt vorkommen) ----------
-- Nur anlegen, wenn es keine Doppelten gibt – sonst würde die Migration scheitern
do $$
begin
  if not exists (select 1 from public.profiles where twitch_login is not null group by lower(twitch_login) having count(*) > 1) then
    create unique index if not exists profiles_twitch_login_lower_idx on public.profiles (lower(twitch_login));
  else
    raise notice 'Doppelte Twitch-Namen vorhanden – eindeutiger Index übersprungen';
  end if;
end $$;
