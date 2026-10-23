-- Abschrift der Google-Health-Werte
--
-- Schlaf, Ruhepuls, HRV und Gewicht je Tag. Google bleibt die Quelle; diese
-- Tabellen sind der Vorrat, aus dem Kadenz liest, wenn Google gerade nicht
-- antwortet (die Verbindung läuft im Testmodus jede Woche ab), und aus dem
-- die Diagramme über 90 und 365 Tage kommen. Gesundheitsdaten, also wie jede
-- Tabelle seit 20260916090000_rls_und_rechte: RLS an, keine Policy.

CREATE TABLE "Tageswert" (
    "datum" DATE NOT NULL,
    "schlafMin" INTEGER NOT NULL,
    "tiefschlafMin" INTEGER NOT NULL,
    "ruhepuls" DOUBLE PRECISION NOT NULL,
    "hrv" DOUBLE PRECISION NOT NULL,
    "aktualisiert" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tageswert_pkey" PRIMARY KEY ("datum")
);

-- quelle: "google" (Abschrift) oder "kadenz" (nur hier eingetragen, weil
-- Google den Wert nicht annahm). Nur so lässt sich eine in Google gelöschte
-- Fehlmessung von einem Eintrag unterscheiden, den es dort nie gab.
CREATE TABLE "Gewichtsmessung" (
    "datum" DATE NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "quelle" TEXT NOT NULL DEFAULT 'google',
    "aktualisiert" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gewichtsmessung_pkey" PRIMARY KEY ("datum"),
    CONSTRAINT "Gewichtsmessung_quelle_check" CHECK ("quelle" IN ('google', 'kadenz'))
);

ALTER TABLE "Tageswert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Gewichtsmessung" ENABLE ROW LEVEL SECURITY;
