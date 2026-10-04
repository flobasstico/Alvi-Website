-- Max. 3 Einreichungen pro Nutzer und Woche
create or replace function public.submissions_this_week(p_user uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.submissions
  where user_id = p_user and week = public.current_week();
$$;
revoke execute on function public.submissions_this_week(uuid) from public, anon;
grant execute on function public.submissions_this_week(uuid) to authenticated;

alter policy "einreichen" on public.submissions
  with check (
    user_id = (select auth.uid())
    and status = 'offen'
    and challenge_id is null
    and public.submissions_this_week((select auth.uid())) < 3
  );
