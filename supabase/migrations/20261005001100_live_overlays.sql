-- Kleine OBS-Anzeigen für Loadout-Würfel und Drop-Spot: das letzte Ergebnis jeder Person.
-- Jeder mit Login hat seinen eigenen festen Overlay-Link (/overlay/loadout/<twitch-name>).
create table public.live_overlays (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('loadout', 'drop')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.live_overlays enable row level security;
create policy "lesen" on public.live_overlays for select using (true);
create policy "eigene anlegen" on public.live_overlays for insert to authenticated
  with check (user_id = (select auth.uid()) and pg_column_size(data) < 20000);
create policy "eigene aendern" on public.live_overlays for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and pg_column_size(data) < 20000);

alter publication supabase_realtime add table public.live_overlays;
