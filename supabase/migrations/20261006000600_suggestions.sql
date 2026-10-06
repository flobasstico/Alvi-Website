-- Community-Vorschläge: Einsendungen (nur Text) mit Like/Dislike.
-- Lesen für alle; Einsenden und Bewerten nur eingeloggt (Twitch), höchstens 5 Einsendungen pro Tag (Admins unbegrenzt).
-- Löschen: eigene Einsendung oder Admin.

create table public.suggestions (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index suggestions_author_idx on public.suggestions (author_id, created_at);

create table public.suggestion_votes (
  suggestion_id bigint not null references public.suggestions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key (suggestion_id, user_id)
);

alter table public.suggestions enable row level security;
alter table public.suggestion_votes enable row level security;

create policy "Vorschläge lesen" on public.suggestions for select using (true);
create policy "Stimmen lesen" on public.suggestion_votes for select using (true);
-- Schreiben nur über die Funktionen unten; Löschen: eigene oder Admin
create policy "Vorschlag löschen" on public.suggestions for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

grant select on public.suggestions, public.suggestion_votes to anon, authenticated;
grant delete on public.suggestions to authenticated;

create or replace function public.suggestion_create(p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text := left(trim(coalesce(p_body, '')), 1000);
  new_id bigint;
begin
  if auth.uid() is null then raise exception 'Zum Einsenden mit Twitch einloggen'; end if;
  if cleaned = '' then raise exception 'Bitte einen Vorschlag eingeben'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
     and (select count(*) from public.suggestions where author_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Maximal 5 Vorschläge pro Tag – morgen geht es weiter';
  end if;
  insert into public.suggestions (author_id, body) values (auth.uid(), cleaned) returning id into new_id;
  return new_id;
end;
$$;

-- Bewerten: 1 = Like, -1 = Dislike, 0 = Stimme zurücknehmen
create or replace function public.suggestion_vote(p_id bigint, p_value int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Zum Bewerten mit Twitch einloggen'; end if;
  if p_value not in (-1, 0, 1) then raise exception 'Ungültige Bewertung'; end if;
  if not exists (select 1 from public.suggestions where id = p_id) then raise exception 'Vorschlag nicht gefunden'; end if;
  if p_value = 0 then
    delete from public.suggestion_votes where suggestion_id = p_id and user_id = auth.uid();
  else
    insert into public.suggestion_votes (suggestion_id, user_id, value) values (p_id, auth.uid(), p_value)
    on conflict (suggestion_id, user_id) do update set value = excluded.value;
  end if;
end;
$$;

revoke execute on function public.suggestion_create(text) from public, anon;
revoke execute on function public.suggestion_vote(bigint, int) from public, anon;
grant execute on function public.suggestion_create(text) to authenticated;
grant execute on function public.suggestion_vote(bigint, int) to authenticated;
