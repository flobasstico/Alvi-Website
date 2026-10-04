-- Startdaten (im Admin-Bereich pflegbar)
insert into public.seasons (name, is_current) values ('Aktuelle Season', true);

insert into public.rules (text, category, weight) values
  ('Nur graue Waffen', 'rad', 2),
  ('Kein Bauen', 'rad', 2),
  ('Nur Heilung aus Fischen', 'rad', 1),
  ('Keine Schilde', 'rad', 1),
  ('Nur eine Waffe gleichzeitig', 'rad', 2),
  ('Kein Sprinten', 'rad', 1),
  ('Nur Pickaxe bis zum ersten Kill', 'rad', 1),
  ('Kein Fahrzeug', 'rad', 2),
  ('Nur Loot vom Boden', 'rad', 1),
  ('Erste Waffe muss behalten werden', 'rad', 2),
  ('Keine Kisten öffnen', 'rad', 1),
  ('Nur Scharfschützengewehre', 'rad', 1),
  ('Erst 3 Fische fangen, dann looten', 'drop', 1),
  ('Landen ohne Gleiter-Umweg (direkt runter)', 'drop', 2),
  ('Erste gefundene Waffe ist die einzige', 'drop', 2),
  ('Bis zur zweiten Zone im POI bleiben', 'drop', 1),
  ('Keine Heilung bis zum ersten Kill', 'drop', 1);

insert into public.loot_items (name, rarity, type, season_id)
select v.name, v.rarity, v.type, (select id from public.seasons where is_current)
from (values
  ('Sturmgewehr', 'grau', 'waffe'),
  ('Sturmgewehr', 'gruen', 'waffe'),
  ('Sturmgewehr', 'lila', 'waffe'),
  ('Pump-Shotgun', 'blau', 'waffe'),
  ('Pump-Shotgun', 'gold', 'waffe'),
  ('Taktische Shotgun', 'gruen', 'waffe'),
  ('MP', 'grau', 'waffe'),
  ('MP', 'blau', 'waffe'),
  ('Scharfschützengewehr', 'lila', 'waffe'),
  ('Pistole', 'grau', 'waffe'),
  ('Raketenwerfer', 'lila', 'waffe'),
  ('Mythische Waffe', 'mythisch', 'waffe'),
  ('Kleiner Schildtrank', 'blau', 'heilung'),
  ('Schildtrank', 'lila', 'heilung'),
  ('Medikit', 'gruen', 'heilung'),
  ('Verband', 'grau', 'heilung'),
  ('Flopper', 'blau', 'heilung'),
  ('Schildfisch', 'lila', 'heilung'),
  ('Granate', 'gruen', 'utility'),
  ('Lagerfeuer', 'blau', 'utility'),
  ('Rammbock', 'blau', 'utility'),
  ('Enterhaken', 'lila', 'utility')
) as v(name, rarity, type);

insert into public.drop_spots (name, season_id, x, y)
select v.name, (select id from public.seasons where is_current), v.x, v.y
from (values
  ('Nordküste', 20, 15), ('Zentrum', 50, 50), ('Westwald', 15, 55),
  ('Ostberge', 82, 40), ('Südhafen', 55, 85), ('Insel im See', 40, 35),
  ('Wüstenstadt', 75, 75), ('Burg', 30, 80)
) as v(name, x, y);

insert into public.bingo_tasks (text) values
  ('Kill mit Pickaxe'), ('Top 10 ohne Schild'), ('Gold-Waffe finden'), ('Fisch fangen'),
  ('Kill aus Fahrzeug'), ('3 Kisten in Folge'), ('Kill mit grauer Waffe'), ('Sniper-Kill über 100 m'),
  ('Victory Royale'), ('Kill ohne zu bauen'), ('In der Zone sterben (fast)'), ('Mythische Waffe'),
  ('Revive eines Mitspielers'), ('Lama gefunden'), ('Kill mit Granate'), ('5 Kills'),
  ('Top 5'), ('Doppel-Kill'), ('Geschenk aus Kiste: Heilung'), ('Erste Landung überlebt'),
  ('Kill mit Raketenwerfer'), ('100 Schaden in einem Schuss'), ('Ohne Heilung Top 15'), ('Emote nach Kill'),
  ('Lagerfeuer genutzt'), ('Vom Bus als Letzter abspringen'), ('Kill aus der Luft'), ('Kill mit Pistole');

-- Kurzbeschreibungen für die Loot-Auktion
update public.loot_items set description = d.text
from (values
  ('Sturmgewehr', 'Solides Allround-Gewehr für mittlere Distanz.'),
  ('Pump-Shotgun', 'Hoher Schaden auf kurze Distanz, langsames Nachladen.'),
  ('Taktische Shotgun', 'Schnelle Schussfolge, verzeiht Fehlschüsse.'),
  ('MP', 'Hohe Feuerrate für den Nahkampf.'),
  ('Scharfschützengewehr', 'Ein Treffer, eine Ansage – auf große Distanz.'),
  ('Pistole', 'Klein, präzise und unterschätzt.'),
  ('Raketenwerfer', 'Räumt Builds und Gegner gleichermaßen ab.'),
  ('Mythische Waffe', 'Die stärkste Waffe der Season – wer sie hat, hat Macht.'),
  ('Kleiner Schildtrank', '+25 Schild, schnell getrunken.'),
  ('Schildtrank', '+50 Schild, der Klassiker.'),
  ('Medikit', 'Heilt komplett, dauert aber.'),
  ('Verband', '+15 Leben bis maximal 75.'),
  ('Flopper', 'Fisch, der sofort 40 Leben heilt.'),
  ('Schildfisch', 'Fisch, der 50 Schild gibt.'),
  ('Granate', 'Wurf, Bumm, Bauwerk weg.'),
  ('Lagerfeuer', 'Heilt dich und dein Team langsam.'),
  ('Rammbock', 'Bricht durch Wände und Türen.'),
  ('Enterhaken', 'Schnell rauf, schnell weg.')
) as d(name, text)
where public.loot_items.name = d.name;
