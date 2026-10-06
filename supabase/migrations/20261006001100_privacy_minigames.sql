-- Datenschutzerklärung: Abschnitt zu den Minispielen ergänzen (vor „## Cookies …“, nur einmal)
do $$
declare
  addition text := E'## Minispiele\n'
    || E'Wer eingeloggt ein Minispiel spielt, dessen Runden werden mit Spiel, Start- und Endzeit und Punktzahl gespeichert. Die beste Punktzahl erscheint mit Twitch-Namen und Profilbild in den Bestenlisten (heute, Woche, ewig), im Profil und im Stream-Overlay des Tages-Highscores. Bei privatem Profil erscheinst du in keiner Bestenliste. '
    || E'Start- und Endzeit dienen nur dazu, unplausible Ergebnisse zu erkennen. Ohne Login wird nichts gespeichert.\n'
    || E'Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzung der Spiel-Funktionen).';
  cur text;
begin
  select value into cur from public.site_settings where key = 'datenschutz';
  if cur is null or cur like '%## Minispiele%' then return; end if;
  cur := replace(cur, E'\r\n', E'\n');
  if position(E'## Cookies' in cur) > 0 then
    cur := regexp_replace(cur, E'## Cookies', addition || E'\n\n## Cookies');
  else
    cur := rtrim(cur) || E'\n\n' || addition;
  end if;
  update public.site_settings set value = cur where key = 'datenschutz';
end;
$$;
