-- Bingo: 3×3-Karte statt 5×5, ohne Freifeld (bei 3×3 wäre die freie Mitte zu einfach).
-- Gewinnlinien: 3 Reihen, 3 Spalten, 2 Diagonalen. Mindestens 9 aktive Aufgaben.
-- Laufende Runden laufen weiter: Alvis Karte sind künftig die ersten 9 Aufgaben der Runde.

alter table public.bingo_cards drop constraint bingo_cards_task_ids_check;
-- Bestehende 5×5-Karten bleiben gespeichert, neue Karten haben 9 Felder
alter table public.bingo_cards add constraint bingo_cards_task_ids_check check (array_length(task_ids, 1) = 9) not valid;

create or replace function public.card_has_bingo(p_task_ids bigint[], p_game_id bigint)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  marked boolean[] := array_fill(false, array[9]);
  lines int[][] := array[
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  i int; j int; ok boolean;
begin
  if coalesce(array_length(p_task_ids, 1), 0) <> 9 then return false; end if;
  for i in 1..9 loop
    marked[i] := exists (
      select 1 from public.bingo_marks m
      where m.game_id = p_game_id and m.task_id = p_task_ids[i]
    );
  end loop;
  for i in 1..8 loop
    ok := true;
    for j in 1..3 loop
      if not marked[lines[i][j] + 1] then ok := false; exit; end if;
    end loop;
    if ok then return true; end if;
  end loop;
  return false;
end;
$$;

create or replace function public.validate_bingo_card()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.bingo_games g
    where g.id = new.game_id and g.status = 'laeuft' and new.task_ids <@ g.task_ids
  ) or (select count(distinct t) from unnest(new.task_ids) t) <> 9 then
    raise exception 'Ungültige Bingo-Karte';
  end if;
  new.bingo_at := case when public.card_has_bingo(new.task_ids, new.game_id) then now() end;
  return new;
end;
$$;
