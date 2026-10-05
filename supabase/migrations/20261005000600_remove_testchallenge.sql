-- Einmalige Aufräum-Aktion: Test-Winchallenge „Testchallenge“ (id 1, nie gestartet, kein Stats-Eintrag) löschen.
-- Spiele werden per ON DELETE CASCADE mitgelöscht.
delete from public.win_challenges where id = 1 and title = 'Testchallenge' and challenge_id is null;
