-- Startseite: Icon zu Alvis Epic-Games-Creator-Profil (im Admin unter „Seite“ änderbar)
insert into public.site_settings (key, value)
values ('link_epic', 'https://www.fortnite.com/@alvivb/3028-0252-9816?lang=de')
on conflict (key) do nothing;
