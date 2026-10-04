-- Trigger-Funktionen nicht per RPC aufrufbar machen
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_bingo_winners() from public, anon, authenticated;
-- is_admin() wird in RLS-Policies für angemeldete Nutzer gebraucht, nicht für anon
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
