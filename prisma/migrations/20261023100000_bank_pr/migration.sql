-- Eingetragener Bank-PR
--
-- Die Karte "Echter PR" im Bench-Tab nahm bisher ausschließlich geloggte,
-- saubere Singles — und zeigte damit 90 kg. Jakob nennt 100 kg als seinen
-- echten PR. In Kadenz sind die 100 kg als Satz mit abgehobener Hüfte
-- vermerkt (siehe SetLog.sauber im Schema) und zählen deshalb für
-- Trainingsmax und Schätzung weiterhin nicht; als Bestwert in der Karte gilt
-- jetzt Jakobs Wort. Das Datum kennt er nicht genau, den 25.09.2026 hat er
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
