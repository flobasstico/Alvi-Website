-- Loot-Auktion: 4 Creator bieten verdeckt um Items aus dem Lootpool.
-- Ziehung, Gebotsprüfung, Gleichstands-Los und Auswertung laufen serverseitig.

alter table public.loot_items add column description text;

alter table public.challenges drop constraint challenges_source_check;
alter table public.challenges add constraint challenges_source_check
  check (source in ('rad', 'loadout', 'drop', 'voting', 'versus', 'bingo', 'auktion', 'manuell'));

-- ---------- Tabellen ----------
create table public.auctions (
  id bigint generated always as identity primary key,
  host_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text,
  status text not null default 'lobby' check (status in ('lobby', 'laeuft', 'beendet')),
  season_id bigint references public.seasons (id) on delete set null,
  start_gold int not null default 500 check (start_gold between 0 and 100000 and start_gold % 10 = 0),
  items_per_player int not null default 5 check (items_per_player between 1 and 10),
  bid_step int not null default 10 check (bid_step > 0),
  bid_seconds int not null default 0 check (bid_seconds between 0 and 600),
  no_duplicates boolean not null default false,
  rarities text[] not null default array['grau', 'gruen', 'blau', 'lila', 'gold', 'mythisch'],
  max_players int not null default 4 check (max_players between 2 and 4),
  ended_reason text,
  challenge_id bigint references public.challenges (id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index auctions_host_idx on public.auctions (host_id);
create index auctions_season_idx on public.auctions (season_id);
create index auctions_challenge_idx on public.auctions (challenge_id);

create table public.auction_players (
  auction_id bigint not null references public.auctions (id) on delete cascade,
  seat int not null check (seat between 1 and 4),
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text,
  avatar_url text,
  gold int not null check (gold >= 0),
  item_count int not null default 0,
  acted_round int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (auction_id, seat),
  unique (auction_id, user_id)
);
create index auction_players_user_idx on public.auction_players (user_id);

create table public.auction_rounds (
  id bigint generated always as identity primary key,
  auction_id bigint not null references public.auctions (id) on delete cascade,
  round_no int not null,
  item_id bigint references public.loot_items (id) on delete set null,
  item_name text not null,
  item_rarity text not null,
  item_type text not null,
  item_icon_url text,
  item_description text,
  status text not null default 'bietet' check (status in ('bietet', 'entschieden', 'verworfen')),
  opens_at timestamptz not null default now(),
  deadline timestamptz,
  winner_seat int,
  price int,
  tie boolean not null default false,
  resolved_at timestamptz,
  unique (auction_id, round_no)
);
create index auction_rounds_item_idx on public.auction_rounds (item_id);

create table public.auction_bids (
  round_id bigint not null references public.auction_rounds (id) on delete cascade,
  auction_id bigint not null references public.auctions (id) on delete cascade,
  seat int not null,
  amount int, -- null = Skip
  created_at timestamptz not null default now(),
  primary key (round_id, seat)
);
create index auction_bids_auction_idx on public.auction_bids (auction_id);

-- ---------- Interne Logik (nicht direkt aufrufbar) ----------
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

  if not exists (
    select 1 from public.auction_players p
    where p.auction_id = p_auction and p.item_count < a.items_per_player
  ) then
    update public.auctions set status = 'beendet', ended_reason = 'fertig', ended_at = now() where id = p_auction;
    return;
  end if;

  select li.* into item
  from public.loot_items li
  where li.active
    and li.season_id is not distinct from a.season_id
    and li.rarity = any (a.rarities)
    and (
      not a.no_duplicates
      or li.id not in (
        select r.item_id from public.auction_rounds r
        where r.auction_id = p_auction and r.status = 'entschieden' and r.item_id is not null
      )
    )
  order by random()
  limit 1;

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

  -- Wer (noch) nicht reagiert hat, skippt automatisch
  insert into public.auction_bids (round_id, auction_id, seat, amount)
  select r.id, r.auction_id, p.seat, null
  from public.auction_players p
  join public.auctions a on a.id = p.auction_id
  where p.auction_id = r.auction_id
    and p.item_count < a.items_per_player
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

-- ---------- Aufrufbare Aktionen ----------
create or replace function public.auction_join(p_auction bigint)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.auctions;
  uid uuid := auth.uid();
  existing int;
  free_seat int;
  prof public.profiles;
begin
  if uid is null then raise exception 'Bitte einloggen'; end if;
  select * into a from public.auctions where id = p_auction for update;
  if a.id is null then raise exception 'Auktion nicht gefunden'; end if;

  select seat into existing from public.auction_players where auction_id = p_auction and user_id = uid;
  if existing is not null then return existing; end if;
  if a.status <> 'lobby' then raise exception 'Die Auktion läuft bereits'; end if;

  select s into free_seat
  from generate_series(1, a.max_players) s
  where s not in (select seat from public.auction_players where auction_id = p_auction)
  order by s limit 1;
  if free_seat is null then raise exception 'Alle Plätze sind belegt'; end if;

  select * into prof from public.profiles where id = uid;
  insert into public.auction_players (auction_id, seat, user_id, display_name, avatar_url, gold)
  values (p_auction, free_seat, uid, coalesce(prof.display_name, 'Spieler ' || free_seat), prof.avatar_url, a.start_gold);
  return free_seat;
end;
$$;

-- Ohne p_seat: selbst verlassen. Mit p_seat: Host entfernt einen Spieler.
create or replace function public.auction_leave(p_auction bigint, p_seat int default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.auctions;
  uid uuid := auth.uid();
begin
  select * into a from public.auctions where id = p_auction for update;
  if a.status <> 'lobby' then raise exception 'Nur in der Lobby möglich'; end if;
  if p_seat is null then
    delete from public.auction_players where auction_id = p_auction and user_id = uid;
  elsif a.host_id = uid then
    delete from public.auction_players where auction_id = p_auction and seat = p_seat;
  else
    raise exception 'Nur der Host kann Spieler entfernen';
  end if;
end;
$$;

create or replace function public.auction_start(p_auction bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.auctions;
begin
  select * into a from public.auctions where id = p_auction for update;
  if a.host_id is distinct from auth.uid() then raise exception 'Nur der Host kann starten'; end if;
  if a.status <> 'lobby' then raise exception 'Auktion wurde schon gestartet'; end if;
  if (select count(*) from public.auction_players where auction_id = p_auction) < 2 then
    raise exception 'Mindestens 2 Spieler nötig';
  end if;
  update public.auctions set status = 'laeuft' where id = p_auction;
  perform public.auction_next_round(p_auction, 3);
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
  needed int;
  acted int;
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
  if exists (select 1 from public.auction_bids where round_id = r.id and seat = p.seat) then
    raise exception 'Du hast in dieser Runde schon gehandelt';
  end if;
  if p_amount is not null then
    if p_amount < 0 or p_amount % a.bid_step <> 0 then
      raise exception 'Gebote nur in %er-Schritten', a.bid_step;
    end if;
    if p_amount > p.gold then raise exception 'Nicht genug Gold'; end if;
  end if;

  insert into public.auction_bids (round_id, auction_id, seat, amount) values (r.id, a.id, p.seat, p_amount);
  update public.auction_players set acted_round = r.round_no where auction_id = a.id and seat = p.seat;

  select count(*) into needed from public.auction_players where auction_id = a.id and item_count < a.items_per_player;
  select count(*) into acted from public.auction_bids where round_id = r.id;
  if acted >= needed then
    perform public.auction_resolve_round(r.id);
  end if;
end;
$$;

-- Von Clients aufgerufen, wenn der Countdown abgelaufen ist (idempotent)
create or replace function public.auction_resolve_expired(p_round bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.auction_rounds;
begin
  select * into r from public.auction_rounds where id = p_round;
  if r.id is null then return; end if;
  perform 1 from public.auctions where id = r.auction_id for update;
  select * into r from public.auction_rounds where id = p_round;
  if r.status = 'bietet' and r.deadline is not null and now() >= r.deadline then
    perform public.auction_resolve_round(r.id);
  end if;
end;
$$;

revoke execute on function public.auction_next_round(bigint, int) from public, anon, authenticated;
revoke execute on function public.auction_resolve_round(bigint) from public, anon, authenticated;
revoke execute on function public.auction_join(bigint) from public, anon;
revoke execute on function public.auction_leave(bigint, int) from public, anon;
revoke execute on function public.auction_start(bigint) from public, anon;
revoke execute on function public.auction_bid(bigint, int) from public, anon;
revoke execute on function public.auction_resolve_expired(bigint) from public, anon;
grant execute on function public.auction_join(bigint) to authenticated;
grant execute on function public.auction_leave(bigint, int) to authenticated;
grant execute on function public.auction_start(bigint) to authenticated;
grant execute on function public.auction_bid(bigint, int) to authenticated;
grant execute on function public.auction_resolve_expired(bigint) to authenticated;

-- ---------- RLS ----------
alter table public.auctions enable row level security;
alter table public.auction_players enable row level security;
alter table public.auction_rounds enable row level security;
alter table public.auction_bids enable row level security;

create policy "lesen" on public.auctions for select using (true);
create policy "lesen" on public.auction_players for select using (true);
create policy "lesen" on public.auction_rounds for select using (true);
-- Gebote sind verdeckt, bis die Runde ausgewertet ist (eigenes Gebot ist immer sichtbar)
create policy "lesen" on public.auction_bids for select using (
  exists (
    select 1 from public.auction_rounds r
    where r.id = auction_bids.round_id and r.status <> 'bietet'
  )
  or exists (
    select 1 from public.auction_players p
    where p.auction_id = auction_bids.auction_id and p.seat = auction_bids.seat and p.user_id = (select auth.uid())
  )
);

create policy "admin insert" on public.auctions for insert to authenticated
  with check ((select public.is_admin()) and host_id = (select auth.uid()) and status = 'lobby');
create policy "admin update" on public.auctions for update to authenticated using ((select public.is_admin()));
create policy "admin delete" on public.auctions for delete to authenticated using ((select public.is_admin()));

-- ---------- Realtime ----------
alter publication supabase_realtime add table
  public.auctions, public.auction_players, public.auction_rounds, public.auction_bids;
