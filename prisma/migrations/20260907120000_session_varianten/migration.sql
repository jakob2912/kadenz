-- Session-Varianten und die Sauberkeit eines Satzes
--
-- Zwei Änderungen, die dieselbe Frage beantworten: was genau ist an diesem Tag
-- unter der Hantel passiert, und zählt es.
--
-- ─────────────────────────────────────────────────────────────
-- 1. Uebung.variante — Push sieht nicht an jedem Push-Tag gleich aus
-- ─────────────────────────────────────────────────────────────
--
-- Der Katalog kannte bis hierher nur "push" und "pull". Damit erschien jede
-- Übung an jedem Tag ihrer Einheit. Tatsächlich wechseln sich zwei Formen ab,
-- und zwar schon seit dem 27.08.2026: der TM-Tag mit schwerem
-- Langhantel-Bankdrücken nach 5/3/1, und die Push-Einheit dazwischen, die
-- bisher dasselbe Bankdrücken bei 72,5 % des Trainingsmax gelaufen ist.
--
-- Was sich jetzt ändert: die leichte Einheit bekommt eine eigene Übung statt
-- desselben Namens bei weniger Gewicht. Das ist nicht Kosmetik. Alle
-- submaximalen Sätze liefen bislang als "Bankdrücken" in dieselbe Historie —
-- der Kraftverlauf mischte 65-kg-Wiederholungssätze unter die schweren, und
-- die ZULETZT-Spalte am TM-Tag zeigte je nach Reihenfolge den leichten Tag.
--
-- Kein Wochentagsfeld, obwohl der Wunsch so formuliert war: Jakobs Rotation
-- läuft alle drei Tage, ein Montag ist mal Push, mal Pull, mal Pause. Was
-- tatsächlich abwechselt, ist die Position in der 5/3/1-Welle.

-- AlterTable
ALTER TABLE "Uebung" ADD COLUMN "variante" TEXT;

-- ─────────────────────────────────────────────────────────────
-- 2. SetLog.sauber — ein Satz kann stehen, ohne zu zählen
-- ─────────────────────────────────────────────────────────────
--
-- NULL ist "nicht beurteilt" und bleibt der Normalfall. Ein ausdrückliches
-- false heißt: die Wiederholung ging durch, die Form nicht — bei Jakob die
-- Hüfte, die sich von der Bank hebt. Genau so kam sein All-Time-Bestwert von
-- 100 kg zustande, und daraus einen Trainingsmax fortzuschreiben hieße, mit
-- Kilogramm zu rechnen, die technisch nie gestanden haben.

-- AlterTable
ALTER TABLE "SetLog" ADD COLUMN "sauber" BOOLEAN;

-- ─────────────────────────────────────────────────────────────
-- 3. Der Katalog
-- ─────────────────────────────────────────────────────────────
--
-- Zwei neue Übungen, beide submaximal und beide ausdrücklich ohne Programm:
-- ihre Gewichte steuert progression() aus der eigenen Historie, wie bei jeder
-- gewöhnlichen Übung. Das ist die geforderte Unabhängigkeit vom Trainingsmax
-- — und sie ist billiger zu haben als ein zweites Programm, das mit dem
-- ersten in Widerspruch geraten könnte.
--
-- Die Startgewichte sind bewusst konservativ und ausdrücklich zum Korrigieren:
-- Paused und Spoto sind bei gleichem Gewicht schwerer als das
-- Berührungs-Bankdrücken, und Jakobs bisherige leichte Einheit lief bei 65 kg.
-- 60 bzw. 55 kg lassen Luft. progression() holt ab acht Wiederholungen im
-- ersten Satz von selbst 2,5 kg drauf.
--
-- Positionen: das Bankdrücken behält Platz 1 bei Push, die Paused Bench
-- bekommt Platz 2, alles Bisherige rückt eine Stelle nach hinten. Am selben
-- Tag steht immer nur eine der beiden, die sichtbare Reihenfolge bleibt also
-- unverändert — die Presse zuerst, danach der Rest.
--
-- Verschoben wird zweistufig über negative Plätze. @@unique([einheit,
-- position]) prüft Postgres sofort und nicht erst am Ende der Transaktion;
-- wer Platz 2 auf 3 schiebt, während 3 noch besetzt ist, läuft in den
-- Konflikt. Dasselbe Vorgehen wie positionenSchreiben() in uebungen.ts.

-- Push: Plätze 2..n zunächst parken
UPDATE "Uebung" SET "position" = -"position" WHERE "einheit" = 'push' AND "position" >= 2;
UPDATE "Uebung" SET "position" = -"position" + 1 WHERE "einheit" = 'push' AND "position" < 0;

-- Pull: alles parken, Platz 1 wird für die Spoto Press frei
UPDATE "Uebung" SET "position" = -"position" WHERE "einheit" = 'pull';
UPDATE "Uebung" SET "position" = -"position" + 1 WHERE "einheit" = 'pull' AND "position" < 0;

-- Das schwere Bankdrücken steht künftig nur noch am TM-Tag.
UPDATE "Uebung" SET "variante" = 'schwer' WHERE "einheit" = 'push' AND "name" = 'Bankdrücken';

INSERT INTO "Uebung" ("id", "einheit", "position", "name", "notiz", "programm", "variante", "saetze", "saetzeBankTag", "startKg", "startWdh")
VALUES
  (
    'uebung_paused_bench',
    'push', 2, 'Paused Bench Press',
    '1 s Pause auf der Brust, submaximal — Reserve lassen. Steuert sich selbst aus der Historie, unabhängig vom Trainingsmax.',
    NULL, 'leicht', 3, NULL, 60, ARRAY[5, 5, 5]
  ),
  (
    'uebung_spoto_press',
    'pull', 1, 'Spoto Press',
    'Pause 2–3 cm über der Brust, 2 Sätze submaximal. Frequenz an der Hantel, kein Auswertungssatz.',
    NULL, 'presse', 2, NULL, 55, ARRAY[5, 5]
  );
