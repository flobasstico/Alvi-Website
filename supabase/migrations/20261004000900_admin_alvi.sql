-- Alvi als Admin (Twitch: AlviVB)
insert into public.admin_logins (twitch_login) values ('alvivb') on conflict do nothing;
