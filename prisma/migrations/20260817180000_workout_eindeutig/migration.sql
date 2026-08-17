-- Eine Trainingseinheit pro Tag und Art.
--
-- Ohne diesen Index konnten zwei gleichzeitige Aufrufe von workoutHeute()
-- beide "noch nichts da" lesen und beide eine Zeile anlegen. Die Sätze eines
-- Tages verteilten sich dann auf zwei Einheiten, und letzteSaetze() liest nur
-- eine davon — beim nächsten Training fehlte die Hälfte.
--
-- Mit dem Index entscheidet die Datenbank, wer zuerst da war; workoutHeute()
-- kann dadurch auf ein atomares upsert umgestellt werden.
CREATE UNIQUE INDEX "Workout_date_kind_key" ON "Workout"("date", "kind");
