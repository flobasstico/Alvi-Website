-- Creator-Liga: jeder Creator mit seinem YouTube-Kanal (Pflicht beim Anlegen/Ändern über den Admin-Bereich)
alter table public.creators
  add column youtube_url text check (youtube_url is null or youtube_url ~* '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/\S+$');
