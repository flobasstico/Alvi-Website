-- Datenschutzerklärung: Abschnitte zu Zuschauerprofilen, Ranglisten (StreamElements) und Vorschlägen ergänzen.
-- Wird vor „## Cookies …“ eingefügt (sonst am Ende angehängt); läuft nur, wenn der Abschnitt noch fehlt.
do $$
declare
  addition text := E'## Zuschauerprofile und Sichtbarkeit\n'
    || E'Wer sich mit Twitch anmeldet, erhält ein Profil unter /profil/<Twitch-Name>. Es zeigt Twitch-Namen, Anzeigenamen, Profilbild, die auf der Website gespielten Runden mit Siegen, Punkten und Platzierungen, eingereichte Vorschläge, erstellte Bingo-Karten und Abzeichen. '
    || E'Ergebnisse von Runden ohne Admin (Zuschauer-Runden) werden nach dem Beenden zusammengefasst gespeichert (Spiel, Datum, Mitspieler, Sieger, Punkte bzw. Platzierung); die Runde selbst wird gelöscht.\n'
    || E'Im eigenen Profil kannst du die Sichtbarkeit jederzeit auf „Privat“ stellen. Dein Profil ist dann nur für dich sichtbar und du erscheinst in keiner Tabelle oder Rangliste, die von der Website erstellt wird (z. B. Stats, Startseite). Während einer laufenden Mehrspieler-Runde sehen die Mitspieler deinen Namen weiterhin.\n'
    || E'Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzung der Mitspiel-Funktionen) und für die öffentlichen Ranglisten Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer Community-Rangliste). Mit der Einstellung „Privat“ kannst du dem jederzeit widersprechen.\n\n'
    || E'## Community-Ranglisten (StreamElements)\n'
    || E'Die Seite „Ranglisten“ zeigt Watchtime und Kanalpunkte aus dem Stream. Diese Werte erhebt der Chat-Bot StreamElements (StreamElements Inc.) im Twitch-Kanal des Streamers. Die Website ruft sie über die öffentliche Schnittstelle von StreamElements ab und speichert sie nicht dauerhaft (Zwischenspeicher höchstens 15 Minuten). '
    || E'Angezeigt werden Twitch-Name, Watchtime und Punkte – dieselben Werte, die jeder per !watchtime bzw. !points im Chat abrufen kann. Für die Erhebung durch StreamElements gilt deren Datenschutzerklärung.\n'
    || E'Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer Community-Rangliste). Wenn du dort nicht erscheinen möchtest, wende dich an die oben genannte E-Mail-Adresse.\n\n'
    || E'## Community-Vorschläge\n'
    || E'Eingereichte Vorschläge werden mit deinem Twitch-Namen und Profilbild öffentlich angezeigt. Bewertungen (Like/Dislike) werden mit deinem Konto gespeichert, damit jede Person nur einmal abstimmt, aber nicht namentlich angezeigt. Eigene Vorschläge kannst du jederzeit löschen.\n'
    || E'Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.';
  cur text;
begin
  select value into cur from public.site_settings where key = 'datenschutz';
  if cur is null or cur like '%## Zuschauerprofile und Sichtbarkeit%' then return; end if;
  cur := replace(cur, E'\r\n', E'\n');
  if position(E'## Cookies' in cur) > 0 then
    cur := regexp_replace(cur, E'## Cookies', addition || E'\n\n## Cookies');
  else
    cur := rtrim(cur) || E'\n\n' || addition;
  end if;
  update public.site_settings set value = cur where key = 'datenschutz';
end;
$$;
