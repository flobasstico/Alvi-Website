-- Join-Codes für alle Runden mit Mitspielern (Auktion, Eskalation, Loadout, Bingo, Olympiade).
-- Wer die Rundenseite (z. B. über den Stream) kennt, kann ohne Code nicht mehr beitreten.
-- Host und Admins brauchen keinen Code. Der Code liegt in einer eigenen Tabelle ohne Lese-Policy –
-- nur Host und Admins bekommen ihn über join_code().

create table public.join_codes (
  kind text not null check (kind in ('auktion', 'eskalation', 'loadout', 'bingo', 'olympiade')),
  round_id bigint not null,
  code text not null,
  primary key (kind, round_id)
);
alter table public.join_codes enable row level security;
-- Keine Policies: für anon/authenticated weder les- noch schreibbar.

-- 6 Zeichen ohne Verwechsler (kein 0/O, 1/I/L)
create or replace function public.new_join_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
    from generate_series(1, 6);
$$;

create or replace function public.round_host(p_kind text, p_id bigint)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'auktion' then (select host_id from public.auctions where id = p_id)
    when 'eskalation' then (select host_id from public.escalation_sessions where id = p_id)
    when 'loadout' then (select host_id from public.loadout_sessions where id = p_id)
    when 'bingo' then (select host_id from public.bingo_rounds where id = p_id)
    when 'olympiade' then (select host_id from public.olympics where id = p_id)
  end;
$$;

-- Code für Host/Admins abrufen (sonst null)
create or replace function public.join_code(p_kind text, p_id bigint)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return null; end if;
  if public.round_host(p_kind, p_id) is distinct from auth.uid() and not public.is_admin() then return null; end if;
  return (select code from public.join_codes where kind = p_kind and round_id = p_id);
end;
$$;

-- Prüfung beim Beitreten: Host und Admins frei, alle anderen mit passendem Code
create or replace function public.check_join_code(p_kind text, p_id bigint, p_code text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Bitte einloggen'; end if;
  if public.round_host(p_kind, p_id) = auth.uid() or public.is_admin() then return; end if;
  if not exists (
    select 1 from public.join_codes
     where kind = p_kind and round_id = p_id and code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'))
  ) then
    raise exception 'Falscher oder fehlender Join-Code – frag den Host nach dem Code';
  end if;
end;
$$;

-- Code automatisch beim Anlegen einer Runde
create or replace function public.add_join_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.join_codes (kind, round_id, code) values (tg_argv[0], new.id, public.new_join_code())
  on conflict do nothing;
  return null;
end;
$$;

create trigger add_join_code after insert on public.auctions for each row execute function public.add_join_code('auktion');
create trigger add_join_code after insert on public.escalation_sessions for each row execute function public.add_join_code('eskalation');
create trigger add_join_code after insert on public.loadout_sessions for each row execute function public.add_join_code('loadout');
create trigger add_join_code after insert on public.bingo_rounds for each row execute function public.add_join_code('bingo');
create trigger add_join_code after insert on public.olympics for each row execute function public.add_join_code('olympiade');

-- Gelöschte Runden: Code mit weg
create or replace function public.drop_join_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.join_codes where kind = tg_argv[0] and round_id = old.id;
  return null;
end;
$$;
create trigger drop_join_code after delete on public.auctions for each row execute function public.drop_join_code('auktion');
create trigger drop_join_code after delete on public.escalation_sessions for each row execute function public.drop_join_code('eskalation');
create trigger drop_join_code after delete on public.loadout_sessions for each row execute function public.drop_join_code('loadout');
create trigger drop_join_code after delete on public.bingo_rounds for each row execute function public.drop_join_code('bingo');
create trigger drop_join_code after delete on public.olympics for each row execute function public.drop_join_code('olympiade');

-- Bestehende Runden bekommen ebenfalls einen Code
insert into public.join_codes (kind, round_id, code) select 'auktion', id, public.new_join_code() from public.auctions on conflict do nothing;
insert into public.join_codes (kind, round_id, code) select 'eskalation', id, public.new_join_code() from public.escalation_sessions on conflict do nothing;
insert into public.join_codes (kind, round_id, code) select 'loadout', id, public.new_join_code() from public.loadout_sessions on conflict do nothing;
insert into public.join_codes (kind, round_id, code) select 'bingo', id, public.new_join_code() from public.bingo_rounds on conflict do nothing;
insert into public.join_codes (kind, round_id, code) select 'olympiade', id, public.new_join_code() from public.olympics on conflict do nothing;

-- Beitreten mit Code: die bisherigen Funktionen werden zu internen Bausteinen,
-- die öffentlichen Namen prüfen erst den Code. Interne Aufrufe (Host tritt beim Anlegen bei) laufen weiter.
alter function public.auction_join(bigint) rename to auction_join_inner;
alter function public.escalation_join(bigint) rename to escalation_join_inner;
alter function public.loadout_join(bigint) rename to loadout_join_inner;
alter function public.bingo_join(bigint) rename to bingo_join_inner;
alter function public.olympic_join(bigint) rename to olympic_join_inner;
revoke execute on function public.auction_join_inner(bigint) from public, anon, authenticated;
revoke execute on function public.escalation_join_inner(bigint) from public, anon, authenticated;
revoke execute on function public.loadout_join_inner(bigint) from public, anon, authenticated;
revoke execute on function public.bingo_join_inner(bigint) from public, anon, authenticated;
revoke execute on function public.olympic_join_inner(bigint) from public, anon, authenticated;

create or replace function public.auction_join(p_auction bigint, p_code text default null)
returns int language plpgsql security definer set search_path = '' as $$
begin
  perform public.check_join_code('auktion', p_auction, p_code);
  return public.auction_join_inner(p_auction);
end;
$$;
create or replace function public.escalation_join(p_session bigint, p_code text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.check_join_code('eskalation', p_session, p_code);
  perform public.escalation_join_inner(p_session);
end;
$$;
create or replace function public.loadout_join(p_session bigint, p_code text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.check_join_code('loadout', p_session, p_code);
  perform public.loadout_join_inner(p_session);
end;
$$;
create or replace function public.bingo_join(p_round bigint, p_code text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.check_join_code('bingo', p_round, p_code);
  perform public.bingo_join_inner(p_round);
end;
$$;
create or replace function public.olympic_join(p_id bigint, p_code text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.check_join_code('olympiade', p_id, p_code);
  perform public.olympic_join_inner(p_id);
end;
$$;

revoke execute on function public.new_join_code() from public, anon, authenticated;
revoke execute on function public.round_host(text, bigint) from public, anon, authenticated;
revoke execute on function public.check_join_code(text, bigint, text) from public, anon, authenticated;
revoke execute on function public.add_join_code() from public, anon, authenticated;
revoke execute on function public.drop_join_code() from public, anon, authenticated;
revoke execute on function public.join_code(text, bigint) from public, anon;
grant execute on function public.join_code(text, bigint) to authenticated;
revoke execute on function public.auction_join(bigint, text) from public, anon;
revoke execute on function public.escalation_join(bigint, text) from public, anon;
revoke execute on function public.loadout_join(bigint, text) from public, anon;
revoke execute on function public.bingo_join(bigint, text) from public, anon;
revoke execute on function public.olympic_join(bigint, text) from public, anon;
grant execute on function public.auction_join(bigint, text) to authenticated;
grant execute on function public.escalation_join(bigint, text) to authenticated;
grant execute on function public.loadout_join(bigint, text) to authenticated;
grant execute on function public.bingo_join(bigint, text) to authenticated;
grant execute on function public.olympic_join(bigint, text) to authenticated;
