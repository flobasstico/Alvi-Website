-- Admin-Liste per Twitch-Name: Wer hier steht, wird beim ersten Twitch-Login automatisch Admin
-- (bzw. sofort, falls schon ein Profil existiert). Pflege nur per SQL-Editor/Service-Rolle.

create table public.admin_logins (
  twitch_login text primary key check (twitch_login = lower(twitch_login)),
  created_at timestamptz not null default now()
);
alter table public.admin_logins enable row level security;
-- Keine Policies: für anon/authenticated weder les- noch schreibbar.

-- Alle Namensfelder, die Twitch über Supabase liefern kann, kleingeschrieben
create or replace function public.twitch_names(meta jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array_remove(array[
    lower(meta ->> 'slug'),
    lower(meta ->> 'name'),
    lower(meta ->> 'preferred_username'),
    lower(meta ->> 'nickname'),
    lower(meta ->> 'user_name'),
    lower(meta ->> 'full_name')
  ], null);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, twitch_login, display_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'slug', new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'preferred_username'),
    coalesce(new.raw_user_meta_data ->> 'nickname', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    case
      when exists (
        select 1 from public.admin_logins a
        where a.twitch_login = any (public.twitch_names(new.raw_user_meta_data))
      ) then 'admin'
      else 'viewer'
    end
  );
  return new;
end;
$$;

-- Neuer Eintrag in der Admin-Liste → bestehendes Profil sofort befördern
create or replace function public.promote_listed_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
     set role = 'admin'
    from auth.users u
   where u.id = p.id
     and (lower(p.twitch_login) = new.twitch_login or new.twitch_login = any (public.twitch_names(u.raw_user_meta_data)));
  return new;
end;
$$;

create trigger admin_logins_promote
  after insert on public.admin_logins
  for each row execute function public.promote_listed_admin();

revoke execute on function public.promote_listed_admin() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

insert into public.admin_logins (twitch_login) values ('flobasstico');
