-- Join-Codes 4-stellig. Schutz gegen Durchprobieren: nach 5 falschen Versuchen
-- ist die Runde für diese Person 10 Minuten gesperrt.
-- Damit der Fehlversuch gespeichert bleibt, melden die Join-Funktionen einen falschen Code
-- als Rückgabetext (statt per Fehler, der alles zurückrollen würde): null = beigetreten.

create or replace function public.new_join_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
    from generate_series(1, 4);
$$;
update public.join_codes set code = public.new_join_code();

create table public.join_attempts (
  kind text not null,
  round_id bigint not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  failed int not null default 0,
  last_failed_at timestamptz not null default now(),
  primary key (kind, round_id, user_id)
);
alter table public.join_attempts enable row level security;
-- Keine Policies: nur über die Funktionen

drop function public.check_join_code(text, bigint, text);
create function public.check_join_code(p_kind text, p_id bigint, p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.join_attempts;
begin
  if auth.uid() is null then raise exception 'Bitte einloggen'; end if;
  if public.round_host(p_kind, p_id) = auth.uid() or public.is_admin() then return null; end if;
  select * into a from public.join_attempts where kind = p_kind and round_id = p_id and user_id = auth.uid();
  if a.failed >= 5 and a.last_failed_at > now() - interval '10 minutes' then
    return 'Zu viele falsche Versuche – in 10 Minuten nochmal probieren';
  end if;
  if exists (
    select 1 from public.join_codes
     where kind = p_kind and round_id = p_id and code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'))
  ) then
    delete from public.join_attempts where kind = p_kind and round_id = p_id and user_id = auth.uid();
    return null;
  end if;
  insert into public.join_attempts (kind, round_id, user_id, failed, last_failed_at)
  values (p_kind, p_id, auth.uid(), 1, now())
  on conflict (kind, round_id, user_id) do update
    set failed = case when public.join_attempts.last_failed_at < now() - interval '10 minutes' then 1 else public.join_attempts.failed + 1 end,
        last_failed_at = now();
  return 'Falscher oder fehlender Join-Code – frag den Host nach dem Code';
end;
$$;
revoke execute on function public.check_join_code(text, bigint, text) from public, anon, authenticated;

drop function public.auction_join(bigint, text);
drop function public.escalation_join(bigint, text);
drop function public.loadout_join(bigint, text);
drop function public.bingo_join(bigint, text);
drop function public.olympic_join(bigint, text);

create function public.auction_join(p_auction bigint, p_code text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare msg text := public.check_join_code('auktion', p_auction, p_code);
begin
  if msg is not null then return msg; end if;
  perform public.auction_join_inner(p_auction);
  return null;
end;
$$;
create function public.escalation_join(p_session bigint, p_code text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare msg text := public.check_join_code('eskalation', p_session, p_code);
begin
  if msg is not null then return msg; end if;
  perform public.escalation_join_inner(p_session);
  return null;
end;
$$;
create function public.loadout_join(p_session bigint, p_code text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare msg text := public.check_join_code('loadout', p_session, p_code);
begin
  if msg is not null then return msg; end if;
  perform public.loadout_join_inner(p_session);
  return null;
end;
$$;
create function public.bingo_join(p_round bigint, p_code text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare msg text := public.check_join_code('bingo', p_round, p_code);
begin
  if msg is not null then return msg; end if;
  perform public.bingo_join_inner(p_round);
  return null;
end;
$$;
create function public.olympic_join(p_id bigint, p_code text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare msg text := public.check_join_code('olympiade', p_id, p_code);
begin
  if msg is not null then return msg; end if;
  perform public.olympic_join_inner(p_id);
  return null;
end;
$$;

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

-- Gelöschte Runden: Code und Fehlversuche mit weg
create or replace function public.drop_join_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.join_codes where kind = tg_argv[0] and round_id = old.id;
  delete from public.join_attempts where kind = tg_argv[0] and round_id = old.id;
  return null;
end;
$$;
