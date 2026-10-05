-- Loadout-Würfel: höchstens 3 Würfe (ganzes Loadout oder einzelner Slot zählen je 1), danach ist das Loadout fest.
-- In Mehrspieler-Runden zählt die Datenbank mit, damit Neuladen nichts bringt.
alter table public.loadout_players add column rolls int not null default 0;
update public.loadout_players set rolls = 1 where rolled_at is not null;

create or replace function public.loadout_set_items(p_session bigint, p_items bigint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.loadout_sessions;
  ids bigint[];
  bad int;
  me public.loadout_players;
begin
  select * into s from public.loadout_sessions where id = p_session;
  if s.id is null then raise exception 'Runde nicht gefunden'; end if;
  if s.status <> 'offen' then raise exception 'Die Loadouts sind schon fest'; end if;
  select * into me from public.loadout_players where session_id = p_session and user_id = auth.uid();
  if me.user_id is null then raise exception 'Zuerst der Runde beitreten'; end if;
  if me.rolls >= 3 then raise exception 'Du hast schon 3-mal gewürfelt – dein Loadout ist fest'; end if;
  if cardinality(p_items) <> s.slots then raise exception 'Ungültige Anzahl Slots'; end if;
  select array_agg(x) into ids from unnest(p_items) x where x is not null;
  ids := coalesce(ids, '{}');

  select count(*) into bad
  from unnest(ids) x
  left join public.loot_items li
    on li.id = x and li.active and li.season_id = s.season_id and li.rarity = any (s.rarities)
  where li.id is null;
  if bad > 0 then raise exception 'Item nicht im Pool dieser Runde'; end if;

  if (select count(distinct lower(li.name)) from public.loot_items li where li.id = any (ids)) <> cardinality(ids) then
    raise exception 'Jedes Item darf nur einmal im Loadout sein';
  end if;

  update public.loadout_players set item_ids = p_items, rolled_at = now(), rolls = rolls + 1
   where session_id = p_session and user_id = auth.uid();
end;
$$;
