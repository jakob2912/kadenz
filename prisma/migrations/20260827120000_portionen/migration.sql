-- Der Ernährungsplan folgt dem Kalorienziel.
--
-- Bis hierher standen beide nebeneinander und wussten nichts voneinander: das
-- Ziel in "Ernaehrungsziel", die Mengen in "Zutat". Wer am 27.08.2026 den
-- Coach-Vorschlag von 3600 auf 3400 kcal annahm, sah danach das neue Ziel über
-- einem Plan, der weiterhin 150 g Reis, 100 g Haferflocken und 40 g
-- Maltodextrin auflistete — also die Mengen für 3600. Die Anpassung war eine
-- Zahl auf der Seite, kein Essen auf dem Teller.
--
-- Die Spalte sagt, welche Zutat die Änderung mitträgt. Der Coach bewegt
-- ausschließlich die Kohlenhydrate (Eiweiß und Fett bleiben, siehe
-- kalorienAnpassung() in src/lib/coach.ts), also sind es die
-- Kohlenhydratquellen, die im Teller weniger werden. Skaliert wird
-- proportional über das Verhältnis der Kohlenhydratziele; eine Nährwertrechnung
-- je Zutat gibt es bewusst nicht, weil Kadenz keine Nährwerttabelle hat und
-- sich keine ausdenkt.

-- AlterTable
ALTER TABLE "Zutat" ADD COLUMN     "anpassbar" BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- Die Kohlenhydratquellen des Fitnessbell-Plans
-- ─────────────────────────────────────────────────────────────
--
-- Reis steht in Meal 1 und Meal 4, Haferflocken in Meal 2 und Meal 5 — beide
-- Vorkommen tragen mit, deshalb über den Namen und nicht über die Position.
--
-- Nicht dabei und mit Absicht:
--   Banane (Meal 2, Meal 3) — Stückzahl, lässt sich nicht auf 0,9 Stück
--     bringen. Steht in ZutatMengen ohnehin unter dem Vorbehalt einheit = 'g'.
--   Beeren, Gemüse — Volumen und Sättigung, nicht die Stellschraube.
--   Whey, Rindertartar, Hühnchen, Ei, Magertopfen — Eiweiß, bleibt.
--   Olivenöl, Nussmus, Nüsse — Fett, bleibt.
UPDATE "Zutat" SET "anpassbar" = true
WHERE "einheit" = 'g'
  AND "name" IN ('Reis', 'Haferflocken', 'Reispudding', 'Maltodextrin');
