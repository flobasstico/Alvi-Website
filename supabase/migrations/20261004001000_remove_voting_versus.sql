-- Community-Voting und Versus-Scoreboard entfernt (inkl. Realtime-Publikation, Views, Funktionen).

drop view if exists public.submission_scores;
drop table if exists public.votes;
drop table if exists public.submissions;
drop function if exists public.submissions_this_week(uuid);
drop function if exists public.set_submission_week();
drop function if exists public.current_week();

drop table if exists public.versus_checklist;
drop table if exists public.versus_matches;
-- Die erlaubten Challenge-Quellen setzt 20261004001100_escalation.sql (ohne voting/versus).
