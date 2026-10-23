-- Eingetragener Bank-PR
--
-- Die Karte "Echter PR" im Bench-Tab nahm bisher ausschließlich geloggte,
-- saubere Singles — und zeigte damit 90 kg. Jakobs tatsächlicher Bestwert
-- sind 100 kg, gehoben vor der Zeit, aus der Kadenz saubere Singles kennt;
-- das genaue Datum ist nicht überliefert, der 25.09.2026 ist von Jakob
-- festgelegt.
--
-- Bewusst als Einstellung und nicht als erfundener Satz in SetLog: ein Satz
-- dort ginge in Trainingsmax-Schätzung, Kraftverlauf und Bestwerte ein. Der
-- eingetragene PR ist nur eine Anzeige. Hebt Jakob mehr als 100 kg sauber,
-- gewinnt der geloggte Single von selbst (siehe bankuebersicht()).
--
-- ON CONFLICT DO NOTHING: ist der Wert inzwischen über den MCP-Server
-- (bank_pr_setzen) geändert, bleibt die Änderung stehen.

INSERT INTO "Einstellung" ("schluessel", "wert", "aktualisiert")
VALUES ('bank_pr', '{"kg":100,"datum":"2026-09-25"}', CURRENT_TIMESTAMP)
ON CONFLICT ("schluessel") DO NOTHING;
