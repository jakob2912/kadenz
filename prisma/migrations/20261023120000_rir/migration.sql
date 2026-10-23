-- Wiederholungen in Reserve je Satz
--
-- Freiwillige Angabe nach dem Satz (0 bis 5). Nur eine neue, nullbare
-- Spalte: der laufende alte Code kennt sie nicht und schreibt sie nicht, das
-- verträgt sich mit dem Zeitfenster zwischen Migration und Umschalten.

ALTER TABLE "SetLog" ADD COLUMN "rir" INTEGER;
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_rir_check" CHECK ("rir" IS NULL OR ("rir" >= 0 AND "rir" <= 5));
