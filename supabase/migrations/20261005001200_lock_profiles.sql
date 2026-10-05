-- Sicherheit: Profile (Twitch-Name, Anzeigename, Bild) kommen nur noch von Twitch über den Anmelde-Trigger.
-- Bisher konnte jeder eingeloggte Nutzer per API seinen eigenen twitch_login/display_name ändern,
-- z. B. auf „alvivb“ – und damit in Stats und Overlays als Alvi gelten. Die Rolle war schon geschützt.
drop policy if exists "eigenes profil" on public.profiles;
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
