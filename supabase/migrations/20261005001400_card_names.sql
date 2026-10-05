-- Bingo-Karten heißen immer wie die Person, die sie erstellt hat (Admins und Zuschauer).
-- Mehrere Karten einer Person werden durchnummeriert: „Kevin“, „Kevin 2“, „Kevin 3“ …

-- Bestehende Karten umbenennen (Reihenfolge nach Erstellung)
with named as (
  select t.id,
         coalesce(p.display_name, p.twitch_login, t.author_name, 'Karte') as base,
         row_number() over (partition by t.author_id order by t.created_at, t.id) as n
    from public.bingo_card_templates t
    left join public.profiles p on p.id = t.author_id
)
update public.bingo_card_templates t
   set title = left(named.base, 54) || case when named.n > 1 then ' ' || named.n else '' end,
       author_name = named.base
  from named
 where named.id = t.id;

-- Karte erstellen: p_title wird ignoriert (Signatur bleibt für die App gleich)
create or replace function public.bingo_card_create(p_title text, p_tasks text[])
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text[];
  prof public.profiles;
  base text;
  name text;
  n int := 1;
  new_id bigint;
begin
  if auth.uid() is null then raise exception 'Zum Erstellen mit Twitch einloggen'; end if;
  select * into prof from public.profiles where id = auth.uid();
  if prof.role is distinct from 'admin'
     and (select count(*) from public.bingo_card_templates where author_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Maximal 5 neue Karten pro Tag – morgen geht es weiter';
  end if;
  select array_agg(left(trim(t), 80) order by i) into cleaned from unnest(p_tasks) with ordinality u(t, i);
  if coalesce(cardinality(cleaned), 0) <> 9 or exists (select 1 from unnest(cleaned) t where t = '') then
    raise exception 'Bitte alle 9 Felder ausfüllen';
  end if;
  if (select count(distinct lower(t)) from unnest(cleaned) t) <> 9 then raise exception 'Jede Aufgabe nur einmal'; end if;

  base := left(coalesce(prof.display_name, prof.twitch_login, 'Karte'), 54);
  name := base;
  while exists (select 1 from public.bingo_card_templates where author_id = auth.uid() and title = name) loop
    n := n + 1;
    name := base || ' ' || n;
  end loop;

  insert into public.bingo_card_templates (title, author_name, tasks, folder, approved)
  values (
    name, coalesce(prof.display_name, prof.twitch_login), cleaned,
    case when prof.role = 'admin' then 'admin' else 'zuschauer' end,
    prof.role = 'admin'
  )
  returning id into new_id;
  return new_id;
end;
$$;
