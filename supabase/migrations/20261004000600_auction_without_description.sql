-- Items haben keine Beschreibungen mehr: Auktionsfunktionen ohne Beschreibung, vorhandene Texte leeren.

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
        auction_id, round_no, item_id, item_name, item_rarity, item_type, item_icon_url,
        status, winner_seat, price, resolved_at
      ) values (
        p_auction, next_no, item.id, item.name, item.rarity, item.type, item.icon_url,
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
    auction_id, round_no, item_id, item_name, item_rarity, item_type, item_icon_url, opens_at, deadline
  ) values (
    p_auction, next_no, item.id, item.name, item.rarity, item.type, item.icon_url,
    now() + make_interval(secs => p_reveal_s),
    case when a.bid_seconds > 0 then now() + make_interval(secs => p_reveal_s + a.bid_seconds) end
  );
end;
$$;

update public.loot_items set description = null where description is not null;
update public.auction_rounds set item_description = null where item_description is not null;
