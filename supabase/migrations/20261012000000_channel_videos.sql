-- Creator-Liga: Videos der Creator-Kanäle (per YouTube-API abgeglichen) als Arbeitsliste im Admin.
-- Nur für Admins sichtbar; „eingepflegt“ ergibt sich aus league_videos.

create table if not exists public.channel_videos (
  video_id text primary key check (video_id ~ '^[\w-]{11}$'),
  creator_id bigint not null references public.creators (id) on delete cascade,
  title text not null,
  published_at timestamptz not null,
  duration_s int,
  is_short boolean not null default false,
  hidden boolean not null default false,
  fetched_at timestamptz not null default now()
);
create index if not exists channel_videos_creator_idx on public.channel_videos (creator_id, published_at desc);

-- Stand des letzten Abgleichs je Kanal (zwischengespeicherte Upload-Playlist, Fehlermeldung)
create table if not exists public.channel_sync (
  creator_id bigint primary key references public.creators (id) on delete cascade,
  channel_id text,
  uploads_playlist text,
  synced_at timestamptz,
  error text,
  video_count int not null default 0
);

alter table public.channel_videos enable row level security;
alter table public.channel_sync enable row level security;
drop policy if exists "admin" on public.channel_videos;
drop policy if exists "admin" on public.channel_sync;
create policy "admin" on public.channel_videos for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin" on public.channel_sync for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Stichwörter für die Challenge-Erkennung (site_settings-Schlüssel liga_stichwoerter) dürfen Admins speichern
drop policy if exists "admin schreiben" on public.site_settings;
drop policy if exists "admin aendern" on public.site_settings;
drop policy if exists "admin loeschen" on public.site_settings;
create policy "admin schreiben" on public.site_settings for insert to authenticated
  with check ((select public.is_admin()) and (key like 'link\_%' or key like 'thumb\_%' or key in ('impressum', 'datenschutz', 'liga_stichwoerter')));
create policy "admin aendern" on public.site_settings for update to authenticated
  using ((select public.is_admin()) and (key like 'link\_%' or key like 'thumb\_%' or key in ('impressum', 'datenschutz', 'liga_stichwoerter')))
  with check ((select public.is_admin()) and (key like 'link\_%' or key like 'thumb\_%' or key in ('impressum', 'datenschutz', 'liga_stichwoerter')));
create policy "admin loeschen" on public.site_settings for delete to authenticated
  using ((select public.is_admin()) and (key like 'link\_%' or key like 'thumb\_%' or key in ('impressum', 'datenschutz', 'liga_stichwoerter')));
