-- Ziel 3.700 kcal, und das letzte Meal bekommt Toast mit Erdnussbutter und
-- Marmelade.
--
-- Anlass (Jakob, 10.11.2026): bei 3.500 kcal haengt er jeden Tag rund 86 kcal
-- vor dem Ziel, weil Reis und Haferflocken zu viel Volumen fuer zu wenig
-- Energie sind. Toast mit Erdnussbutter und Marmelade bringt dieselbe Energie
-- auf weniger Masse. Er soll ins letzte Meal (Haferflocken-Meal), dort mit
-- weniger Haferflocken.
--
-- Vorgaben von Jakob: Eiweiss 180 g, Fett hoechstens 80 g, der Rest der
-- Kalorien aus Kohlenhydraten, mindestens 300 g Gemuese am Tag.
--   180 g Eiweiss  =  720 kcal
--    80 g Fett     =  720 kcal
--   3700 - 1440    = 2260 kcal  ->  565 g Kohlenhydrate
-- Das Fett steht auf der Obergrenze; der Plan selbst kommt auf etwa 75 g.
--
-- Der Plan wird NICHT ueber die Skalierung erreicht. 565 g gegenueber den 560 g
-- des Ausgangsplans ergeben Faktor 1,009, also wieder die Ausgangsmengen
-- (Reis 150, Haferflocken Meal 2 100, Maltodextrin 40). Was sich aendert, ist
-- Meal 5 (Abend).
--
-- Meal 5, vorher: Magertopfen 125 g, Beeren 200 g, Haferflocken 100 g, Nuesse
--   jetzt: dasselbe mit Haferflocken 60 g, dazu 3 Scheiben Vollkorntoast,
--          20 g Erdnussbutter, 40 g Marmelade
-- Grobe Rechnung (Kadenz hat keine Naehrwerttabelle, das sind Packungswerte):
--   Toast + Erdnussbutter + Marmelade rund +400 kcal, 40 g Haferflocken weniger
--   rund -150 kcal, Gemuese auf 150 g je Mahlzeit rund -30 kcal. Gegenueber dem
--   Plan fuer 3.500 sind das etwa +220 kcal.

-- Haferflocken im letzten Meal: 60 statt 100 g.
UPDATE "Zutat" SET "menge" = 60 WHERE "id" = 'zutat-6-3';

INSERT INTO "Zutat" ("id", "mahlzeitId", "position", "name", "menge", "einheit", "alternative", "anpassbar")
VALUES
    ('zutat-6-5', 'mahlzeit-6', 5, 'Vollkorntoast', 3,  'Stk', NULL, false),
    ('zutat-6-6', 'mahlzeit-6', 6, 'Erdnussbutter', 20, 'g',   NULL, false),
    ('zutat-6-7', 'mahlzeit-6', 7, 'Marmelade',     40, 'g',   NULL, false);

-- Gemuese: 150 g je Reis-Mahlzeit, zusammen 300 g.
UPDATE "Zutat" SET "menge" = 150 WHERE "id" IN ('zutat-1-3', 'zutat-5-3');

INSERT INTO "Ernaehrungsziel"
    ("id", "gueltigAb", "kcal", "kohlenhydrateG", "eiweissG", "fettG", "quelle", "begruendung")
VALUES
    ('ziel-3700', DATE '2026-11-10', 3700, 565, 180, 80, 'jakob',
     'Von Hand auf 3700 kcal gesetzt: Eiweiss 180 g, Fett hoechstens 80 g, der Rest aus Kohlenhydraten (565 g). Toast mit Erdnussbutter und Marmelade im letzten Meal, dafuer weniger Haferflocken, weil Reis und Haferflocken allein zu viel Volumen sind. Gemuese mindestens 300 g am Tag.');
