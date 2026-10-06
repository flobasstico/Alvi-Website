-- Creator-Liga: feste Farbe je Creator (optional, sonst automatisch)
alter table public.creators
  add column color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$');

update public.creators set color = '#1d4ed8' where lower(name) = 'alvi';      -- dunkelblau
update public.creators set color = '#f472b6' where lower(name) = 'davenite';  -- bleibt (bisheriges Pink)
update public.creators set color = '#f97316' where lower(name) = 'magican';   -- orange
update public.creators set color = '#22c55e' where lower(name) = 'rubix';     -- grün
update public.creators set color = '#000000' where lower(name) = 'derjonzy';  -- schwarz
