-- Bankdrücken ohne Varianten
--
-- Jakob am 16.09.2026: die Spoto Press am Pull-Tag kommt raus, die Paused
-- Bench Press am leichten Push-Tag auch. Bankdrücken steht wieder an jeder
-- Push-Einheit unter demselben Namen: jede zweite ist der TM-Tag mit AMRAP,
-- die dazwischen ein leichter Tag mit einem schweren Single (bankZusatzPlan()
-- in kraft.ts).
--
-- Damit hat Uebung.variante keinen Zweck mehr — die einzigen Zeilen mit
-- einem Wert waren genau diese drei. Die Spalte geht mit.
--
-- Die geloggten Sätze der beiden Varianten bleiben unangetastet: sie hängen
-- über den Namen in SetLog, nicht am Katalog, und sind weiter im Verlauf
-- sichtbar.

DELETE FROM "Uebung" WHERE "id" IN ('uebung_paused_bench', 'uebung_spoto_press');

UPDATE "Uebung"
SET "notiz" = 'Langhantel, Flachbank — TM-Tag nach 5/3/1 mit AMRAP, dazwischen leicht plus ein schwerer Single'
WHERE "einheit" = 'push' AND "programm" = '531';

-- Lücken schließen. Zweistufig über negative Plätze, weil
-- @@unique([einheit, position]) sofort geprüft wird — dasselbe Vorgehen wie
-- positionenSchreiben() in uebungen.ts.
UPDATE "Uebung" SET "position" = -"position";

UPDATE "Uebung" AS u
SET "position" = r.neu
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "einheit" ORDER BY "position" DESC) AS neu
  FROM "Uebung"
) AS r
WHERE u."id" = r."id";

ALTER TABLE "Uebung" DROP COLUMN "variante";
