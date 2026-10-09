-- Skin-Bild je Creator für die Lobby auf der Startseite (freigestelltes PNG); leer = Profilbild
alter table public.creators add column if not exists skin_url text;

-- Eigene Vorschaubilder der Modi (Schlüssel thumb_<modus>) dürfen Admins ebenfalls setzen
drop policy if exists "admin schreiben" on public.site_settings;
drop policy if exists "admin aendern" on public.site_settings;
drop policy if exists "admin loeschen" on public.site_settings;
create policy "admin schreiben" on public.site_settings for insert to authenticated
  with check ((select public.is_admin()) and (key like 'link\_%' or key like 'thumb\_%' or key in ('impressum', 'datenschutz')));
create policy "admin aendern" on public.site_settings for update to authenticated
  using ((select public.is_admin()) and (key like 'link\_%' or key like 'thumb\_%' or key in ('impressum', 'datenschutz')))
  with check ((select public.is_admin()) and (key like 'link\_%' or key like 'thumb\_%' or key in ('impressum', 'datenschutz')));
create policy "admin loeschen" on public.site_settings for delete to authenticated
  using ((select public.is_admin()) and (key like 'link\_%' or key like 'thumb\_%' or key in ('impressum', 'datenschutz')));
