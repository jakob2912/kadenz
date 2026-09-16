-- Wochenwahl statt Planwechsel
--
-- Der Planwechsel (zwei ganze Wochenpläne) war nach einer Stunde überholt:
-- Jakob schaltet zwei Dinge unabhängig voneinander, und zwar je Woche — den
-- ersten Push auf Mo oder Di, und das Wochenende auf Fr + Sa oder Sa + So.
-- Jede Woche beginnt beim Standard. Die Tabelle Planwechsel war leer.

DROP TABLE "Planwechsel";

CREATE TABLE "Wochenwahl" (
    "woche" DATE NOT NULL,
    "frueh" TEXT,
    "spaet" TEXT,
    "aktualisiert" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wochenwahl_pkey" PRIMARY KEY ("woche"),
    CONSTRAINT "Wochenwahl_montag_check" CHECK (EXTRACT(ISODOW FROM "woche") = 1),
    CONSTRAINT "Wochenwahl_frueh_check" CHECK ("frueh" IN ('mo', 'di')),
    CONSTRAINT "Wochenwahl_spaet_check" CHECK ("spaet" IN ('frsa', 'saso'))
);

-- Wie jede Tabelle seit 20260916090000_rls_und_rechte: RLS an, keine Policy.
ALTER TABLE "Wochenwahl" ENABLE ROW LEVEL SECURITY;
