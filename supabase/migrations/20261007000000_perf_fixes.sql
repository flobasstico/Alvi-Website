-- Performance-Hinweise des Supabase-Advisors:
-- fehlende Indizes auf Fremdschlüsseln und auth.uid() in Richtlinien nur einmal pro Abfrage auswerten.
create index if not exists suggestion_votes_user_idx on public.suggestion_votes (user_id);
create index if not exists join_attempts_user_idx on public.join_attempts (user_id);

drop policy "eigene Runden" on public.minigame_runs;
create policy "eigene Runden" on public.minigame_runs for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy "Vorschlag löschen" on public.suggestions;
create policy "Vorschlag löschen" on public.suggestions for delete to authenticated
  using (author_id = (select auth.uid()) or exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));
