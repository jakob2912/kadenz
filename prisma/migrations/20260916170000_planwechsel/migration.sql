-- Planwechsel: zwei Wochenpläne, umschaltbar
--
-- "werktage" (Mo/Fr Push, Mi/Sa Pull) ist der Standard. "wochenende"
-- (Di/Sa Push, Mi/So Pull) gilt für Wochen, in denen Jakob Mo und Fr
-- nachmittags arbeitet. Jede Zeile heißt: ab diesem Tag gilt dieser Plan.

CREATE TABLE "Planwechsel" (
    "ab" DATE NOT NULL,
    "plan" TEXT NOT NULL,
    "angelegt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Planwechsel_pkey" PRIMARY KEY ("ab"),
    CONSTRAINT "Planwechsel_plan_check" CHECK ("plan" IN ('werktage', 'wochenende'))
);

-- Wie jede Tabelle seit 20260916090000_rls_und_rechte: RLS an, keine Policy.
-- Die Rechte für anon/authenticated nehmen die Default Privileges von dort
-- ohnehin nicht mehr mit.
ALTER TABLE "Planwechsel" ENABLE ROW LEVEL SECURITY;
