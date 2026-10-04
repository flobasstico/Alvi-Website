-- Entfernt die (leeren) Beschreibungs-Spalten.
-- Noch NICHT im Live-Projekt angewendet: im Supabase SQL-Editor ausführen.
alter table public.auction_rounds drop column item_description;
alter table public.loot_items drop column description;
