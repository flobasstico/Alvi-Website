-- Startseite: X/Twitter-Icon entfernen (Discord rückt an die Stelle). Im Admin unter „Seite“ wieder eintragbar.
delete from public.site_settings where key in ('link_x', 'link_x_icon');
