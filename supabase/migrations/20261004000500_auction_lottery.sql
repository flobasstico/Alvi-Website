-- Loot-Auktion: Mindestgebot = Bietschritt (keine 0-Gold-Gebote mehr).
-- Wer nicht mehr genug Gold für das Mindestgebot hat, bietet nicht mehr mit;
-- seine offenen Slots werden am Ende der Auktion zufällig aus dem Pool zugelost.

alter table public.auction_rounds drop constraint auction_rounds_status_check;
alter table public.auction_rounds add constraint auction_rounds_status_check
  check (status in ('bietet', 'entschieden', 'verworfen', 'zugelost'));

-- Zufälliges Item aus dem Pool der Auktion (respektiert Seltenheiten und "Keine Duplikate")
create or replace function public.auction_draw_item(p_auction bigint)
returns public.loot_items
language sql
volatile
security definer
set search_path = ''
as $$
  select li.*
  from public.loot_items li
  join public.auctions a on a.id = p_auction
  where li.active
    and li.season_id is not distinct from a.season_id
    and li.rarity = any (a.rarities)
    and (
      not a.no_duplicates
      or li.id not in (
        select r.item_id from public.auction_rounds r
        where r.auction_id = p_auction and r.status in ('entschieden', 'zugelost') and r.item_id is not null
      )
    )
  order by random()
  limit 1;
$$;

-- Spieler, die noch mitbieten: freie Slots und genug Gold für das Mindestgebot
create or replace function public.auction_bidder_count(p_auction bigint)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.auction_players p
  join public.auctions a on a.id = p.auction_id
  where p.auction_id = p_auction and p.item_count < a.items_per_player and p.gold >= a.bid_step;
$$;

-- Offene Slots der Spieler ohne Gold auslosen und Auktion beenden
create or replace function public.auction_finish(p_auction bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.auctions;
  p public.auction_players;
  item public.loot_items;
  next_no int;
  pool_empty boolean := false;
begin
  select * into a from public.auctions where id = p_auction;
  select coalesce(max(round_no), 0) into next_no from public.auction_rounds where auction_id = p_auction;

  <<players>>
  for p in
    select * from public.auction_players
    where auction_id = p_auction and item_count < a.items_per_player
    order by seat
  loop
    for i in 1 .. (a.items_per_player - p.item_count) loop
      item := public.auction_draw_item(p_auction);
      if item.id is null then
        pool_empty := true;
        exit players;
      end if;
      next_no := next_no + 1;
      insert into public.auction_rounds (
        auction_id, round_no, item_id, item_name, item_rarity, item_type, item_icon_url, item_description,
        status, winner_seat, price, resolved_at
      ) values (
        p_auction, next_no, item.id, item.name, item.rarity, item.type, item.icon_url, item.description,
        'zugelost', p.seat, 0, now()
      );
      update public.auction_players set item_count = item_count + 1 where auction_id = p_auction and seat = p.seat;
    end loop;
  end loop;

  update public.auctions
     set status = 'beendet', ended_reason = case when pool_empty then 'pool_leer' else 'fertig' end, ended_at = now()
   where id = p_auction;
end;
$$;

create or replace function public.auction_next_round(p_auction bigint, p_reveal_s int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.auctions;
  item public.loot_items;
  next_no int;
begin
  select * into a from public.auctions where id = p_auction;

  -- Niemand kann mehr bieten → Rest auslosen
  if public.auction_bidder_count(p_auction) = 0 then
    perform public.auction_finish(p_auction);
    return;
  end if;

  item := public.auction_draw_item(p_auction);
  if item.id is null then
    update public.auctions set status = 'beendet', ended_reason = 'pool_leer', ended_at = now() where id = p_auction;
    return;
  end if;

  select coalesce(max(round_no), 0) + 1 into next_no from public.auction_rounds where auction_id = p_auction;

  insert into public.auction_rounds (
    auction_id, round_no, item_id, item_name, item_rarity, item_type, item_icon_url, item_description, opens_at, deadline
  ) values (
    p_auction, next_no, item.id, item.name, item.rarity, item.type, item.icon_url, item.description,
    now() + make_interval(secs => p_reveal_s),
    case when a.bid_seconds > 0 then now() + make_interval(secs => p_reveal_s + a.bid_seconds) end
  );
end;
$$;

create or replace function public.auction_resolve_round(p_round bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.auction_rounds;
  top int;
  n_top int;
  win int;
begin
  select * into r from public.auction_rounds where id = p_round;
  if r.status <> 'bietet' then return; end if;

  -- Wer mitbieten konnte, aber nicht reagiert hat, skippt automatisch
  insert into public.auction_bids (round_id, auction_id, seat, amount)
  select r.id, r.auction_id, p.seat, null
  from public.auction_players p
  join public.auctions a on a.id = p.auction_id
  where p.auction_id = r.auction_id
    and p.item_count < a.items_per_player
    and p.gold >= a.bid_step
    and not exists (select 1 from public.auction_bids b where b.round_id = r.id and b.seat = p.seat);

  select max(amount) into top from public.auction_bids where round_id = r.id;

  if top is null then
    update public.auction_rounds set status = 'verworfen', resolved_at = now() where id = r.id;
    perform public.auction_next_round(r.auction_id, 2);
    return;
  end if;

  select count(*) into n_top from public.auction_bids where round_id = r.id and amount = top;
  select seat into win from public.auction_bids where round_id = r.id and amount = top order by random() limit 1;

  update public.auction_rounds
     set status = 'entschieden', winner_seat = win, price = top, tie = n_top > 1, resolved_at = now()
   where id = r.id;
  update public.auction_players
     set gold = gold - top, item_count = item_count + 1
   where auction_id = r.auction_id and seat = win;

  perform public.auction_next_round(r.auction_id, 5);
end;
$$;

-- p_amount null = Skip
create or replace function public.auction_bid(p_round bigint, p_amount int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.auction_rounds;
  a public.auctions;
  p public.auction_players;
  uid uuid := auth.uid();
begin
  select * into r from public.auction_rounds where id = p_round;
  if r.id is null then raise exception 'Runde nicht gefunden'; end if;
  -- Auktion sperren: serialisiert alle Gebote einer Auktion
  select * into a from public.auctions where id = r.auction_id for update;
  select * into r from public.auction_rounds where id = p_round;

  if a.status <> 'laeuft' or r.status <> 'bietet' then raise exception 'Diese Runde ist schon vorbei'; end if;
  if now() < r.opens_at then raise exception 'Bieten ist noch nicht offen'; end if;
  if r.deadline is not null and now() > r.deadline + interval '1 second' then raise exception 'Zeit abgelaufen'; end if;

  select * into p from public.auction_players where auction_id = a.id and user_id = uid;
  if p.seat is null then raise exception 'Du spielst in dieser Auktion nicht mit'; end if;
  if p.item_count >= a.items_per_player then raise exception 'Du hast schon alle Items'; end if;
  if p.gold < a.bid_step then raise exception 'Kein Gold mehr – deine offenen Slots werden am Ende zugelost'; end if;
  if exists (select 1 from public.auction_bids where round_id = r.id and seat = p.seat) then
    raise exception 'Du hast in dieser Runde schon gehandelt';
  end if;
  if p_amount is not null then
    if p_amount < a.bid_step then raise exception 'Mindestgebot ist % Gold', a.bid_step; end if;
    if p_amount % a.bid_step <> 0 then raise exception 'Gebote nur in %er-Schritten', a.bid_step; end if;
    if p_amount > p.gold then raise exception 'Nicht genug Gold'; end if;
  end if;

  insert into public.auction_bids (round_id, auction_id, seat, amount) values (r.id, a.id, p.seat, p_amount);
  update public.auction_players set acted_round = r.round_no where auction_id = a.id and seat = p.seat;

  if (select count(*) from public.auction_bids where round_id = r.id) >= public.auction_bidder_count(a.id) then
    perform public.auction_resolve_round(r.id);
  end if;
end;
$$;

revoke execute on function public.auction_draw_item(bigint) from public, anon, authenticated;
revoke execute on function public.auction_bidder_count(bigint) from public, anon, authenticated;
revoke execute on function public.auction_finish(bigint) from public, anon, authenticated;
revoke execute on function public.auction_next_round(bigint, int) from public, anon, authenticated;
revoke execute on function public.auction_resolve_round(bigint) from public, anon, authenticated;
