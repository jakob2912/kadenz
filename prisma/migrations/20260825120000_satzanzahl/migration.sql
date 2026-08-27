-- Die Satzanzahl bekommt einen Platz in der Datenbank.
--
-- Bis hierher stand sie nirgends. heutigeSaetze() in src/lib/plan.ts zählte
-- die Sätze der zuletzt geloggten Einheit und fiel ersatzweise auf die Länge
-- von startWdh zurück. Das ging gut, solange jede Zeile aus dieser Migration
-- hier stammte und ihre Referenzwerte mitbrachte.
--
-- Es ging nicht mehr gut, als über den MCP-Server eine Übung ohne startWdh
-- angelegt wurde: uebungHinzufuegen() schrieb ein leeres Array, zuPlanen()
-- machte daraus eine leere Satzliste, und die Übung stand mit null Sätzen und
-- 0 kg im Plan. Sichtbar wurde das als Übungskarte mit Tabellenkopf und keiner
-- einzigen Zeile darunter.
--
-- Der zweite, leisere Fehler derselben Ursache: hing die Anzahl an der letzten
-- Einheit, schrumpfte der Plan mit. Wer von zwei geplanten Sätzen nur einen
-- abhakte, bekam beim nächsten Training nur noch einen vorgeschlagen — ohne
-- dass irgendwo stand, dass sich etwas geändert hatte.
--
-- Die Werte unten sind Jakobs Regel, nicht geraten: grundsätzlich 2 Sätze,
-- Ausnahmen ausdrücklich als Wert. Für dreizehn der sechzehn Zeilen ändert
-- sich damit nichts — sie stehen längst auf zwei.

-- AlterTable
ALTER TABLE "Uebung" ADD COLUMN     "saetze" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "saetzeBankTag" INTEGER;

-- ─────────────────────────────────────────────────────────────
-- Die drei Ausnahmen
-- ─────────────────────────────────────────────────────────────

-- Hex Squat steht seit dem Kraftwerte-Log (29.07.2026) bewusst auf einem Satz.
-- Über den Namen und nicht über die ID, weil die Zeile im selben Zug auf
-- "Hack Squat" umbenannt wird — das Gerät war von Anfang an falsch erfasst.
UPDATE "Uebung" SET "saetze" = 1 WHERE "einheit" = 'push' AND "name" IN ('Hex Squat', 'Hack Squat');

-- An Bank-Tagen fällt bei der Incline Chest Press ein Satz weg: drei schwere
-- Sätze Langhantel-Bankdrücken treffen dieselbe Muskulatur, und der volle
-- Umfang obendrauf kostet Erholung, ohne mehr zu bringen. An gewöhnlichen
-- Push-Tagen bleiben es zwei.
--
-- Setzt zugleich den Volumen-Trim vom 23.08.2026 zurück, der Butterfly und
-- Incline Chest Press auf je einen Satz gestellt hatte.
UPDATE "Uebung" SET "saetze" = 2, "saetzeBankTag" = 1 WHERE "einheit" = 'push' AND "name" = 'Incline Chest Press';
UPDATE "Uebung" SET "saetze" = 2                      WHERE "einheit" = 'push' AND "name" = 'Butterfly';

-- Beim Bankdrücken gibt der 5/3/1-Zyklus die Sätze vor; heutigeSaetze() nimmt
-- dort den programmSaetze-Zweig und liest "saetze" gar nicht. Trotzdem auf 3
-- gesetzt statt auf dem Default belassen: eine Zeile, die im Katalog "2" sagt
-- und im Training drei Sätze zeigt, liest sich wie ein Fehler.
UPDATE "Uebung" SET "saetze" = 3 WHERE "einheit" = 'push' AND "programm" = '531';
