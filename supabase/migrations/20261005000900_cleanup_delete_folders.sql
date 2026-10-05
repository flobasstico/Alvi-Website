-- 1) Altes Bingo-Modell entfernen (Alvi hakt ab, Zuschauer tippen mit zufälliger eigener Karte mit).
--    Der Aufgaben-Pool bingo_tasks bleibt (füllt leere Felder beim Karten-Erstellen).
-- 2) Bingo-Karten in Ordnern: Admin-Karten und Zuschauer-Karten.
-- 3) Admins können jede gewertete Runde löschen – samt Eintrag in Alvis Statistik.

-- ---------- 1) Altes Bingo ----------
drop trigger if exists bingo_marks_winners on public.bingo_marks;
drop trigger if exists validate_bingo_card on public.bingo_cards;
drop table if exists public.bingo_cards;
drop table if exists public.bingo_marks;
drop table if exists public.bingo_games;
drop function if exists public.update_bingo_winners();
drop function if exists public.validate_bingo_card();
drop function if exists public.card_has_bingo(bigint[], bigint);

-- ---------- 2) Karten-Ordner ----------
alter table public.bingo_card_templates
  add column folder text not null default 'zuschauer' check (folder in ('admin', 'zuschauer'));
update public.bingo_card_templates t
   set folder = 'admin'
  from public.profiles p
 where p.id = t.author_id and p.role = 'admin';
create index bingo_card_templates_folder_idx on public.bingo_card_templates (folder, created_at desc);

-- Karte erstellen: Ordner nach Rolle des Erstellers
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
  select array_agg(left(trim(t), 80) order by n) into cleaned from unnest(p_tasks) with ordinality u(t, n);
  if coalesce(cardinality(cleaned), 0) <> 9 or exists (select 1 from unnest(cleaned) t where t = '') then
    raise exception 'Bitte alle 9 Felder ausfüllen';
  end if;
  if (select count(distinct lower(t)) from unnest(cleaned) t) <> 9 then raise exception 'Jede Aufgabe nur einmal'; end if;
  if nullif(trim(p_title), '') is null then raise exception 'Bitte einen Namen für die Karte eingeben'; end if;
  select * into prof from public.profiles where id = auth.uid();
  insert into public.bingo_card_templates (title, author_name, tasks, folder)
  values (
    left(trim(p_title), 60), coalesce(prof.display_name, prof.twitch_login), cleaned,
    case when prof.role = 'admin' then 'admin' else 'zuschauer' end
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- ---------- 3) Runden löschen (nur Admins) ----------
-- p_kind: eskalation | loadout | auktion | bingo | winchallenge | challenge
-- Löscht die Runde und ihren Eintrag in challenges. Bei 'challenge' wird der Statistik-Eintrag
-- gelöscht und mit ihm die Runde, aus der er stammt.
create or replace function public.admin_delete_round(p_kind text, p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch bigint;
begin
  if not public.is_admin() then raise exception 'Nur Admins löschen Runden'; end if;
  if p_kind = 'eskalation' then
    delete from public.escalation_sessions where id = p_id returning challenge_id into ch;
  elsif p_kind = 'loadout' then
    delete from public.loadout_sessions where id = p_id returning challenge_id into ch;
  elsif p_kind = 'auktion' then
    delete from public.auctions where id = p_id returning challenge_id into ch;
  elsif p_kind = 'bingo' then
    delete from public.bingo_rounds where id = p_id returning challenge_id into ch;
  elsif p_kind = 'winchallenge' then
    delete from public.win_challenges where id = p_id returning challenge_id into ch;
  elsif p_kind = 'challenge' then
    ch := p_id;
    delete from public.escalation_sessions where challenge_id = ch;
    delete from public.loadout_sessions where challenge_id = ch;
    delete from public.auctions where challenge_id = ch;
    delete from public.bingo_rounds where challenge_id = ch;
    delete from public.win_challenges where challenge_id = ch;
  else
    raise exception 'Unbekannte Spielart';
  end if;
  if ch is not null then
    delete from public.challenges where id = ch;
  end if;
end;
$$;

revoke execute on function public.admin_delete_round(text, bigint) from public, anon;
grant execute on function public.admin_delete_round(text, bigint) to authenticated;
