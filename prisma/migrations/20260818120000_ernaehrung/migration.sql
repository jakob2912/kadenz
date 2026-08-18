-- Ernährung: Plan, Kalorienziel mit Historie, Coach-Vorschläge.
--
-- Der Ernährungsplan war im Design-Prototyp enthalten und fiel bei der
-- Umsetzung weg. Bis hierher wusste die App, was Jakob hebt, aber nicht, was
-- er isst — und konnte deshalb auch nicht sagen, was er ändern soll, wenn das
-- Gewicht zu langsam steigt.
--
-- Die Zeilen am Ende sind keine Testdaten: es ist Jakobs tatsächlicher
-- Fitnessbell-Plan aus seiner Ernaehrungsplan.xlsx. Sie stehen in der
-- Migration und nicht in einem Seed-Skript, weil `prisma migrate deploy` sie
-- damit genau einmal einspielt — auf seinem Rechner wie auf Vercel, ohne dass
-- jemand daran denken muss.

-- CreateTable
CREATE TABLE "Mahlzeit" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "fenster" TEXT NOT NULL,

    CONSTRAINT "Mahlzeit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zutat" (
    "id" TEXT NOT NULL,
    "mahlzeitId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "menge" DOUBLE PRECISION NOT NULL,
    "einheit" TEXT NOT NULL,
    "alternative" TEXT,

    CONSTRAINT "Zutat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ernaehrungsziel" (
    "id" TEXT NOT NULL,
    "gueltigAb" DATE NOT NULL,
    "kcal" INTEGER NOT NULL,
    "kohlenhydrateG" INTEGER NOT NULL,
    "eiweissG" INTEGER NOT NULL,
    "fettG" INTEGER NOT NULL,
    "quelle" TEXT NOT NULL,
    "begruendung" TEXT NOT NULL,
    "gesetztAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vorschlagId" TEXT,

    CONSTRAINT "Ernaehrungsziel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kalorienvorschlag" (
    "id" TEXT NOT NULL,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kcalAlt" INTEGER NOT NULL,
    "kcalNeu" INTEGER NOT NULL,
    "kohlenhydrateAltG" INTEGER NOT NULL,
    "kohlenhydrateNeuG" INTEGER NOT NULL,
    "eiweissG" INTEGER NOT NULL,
    "fettG" INTEGER NOT NULL,
    "gemesseneRate" DOUBLE PRECISION NOT NULL,
    "zielRate" DOUBLE PRECISION NOT NULL,
    "begruendung" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offen',
    "entschiedenAm" TIMESTAMP(3),
    "offenSchluessel" TEXT,

    CONSTRAINT "Kalorienvorschlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mahlzeit_position_key" ON "Mahlzeit"("position");

-- CreateIndex
CREATE UNIQUE INDEX "Zutat_mahlzeitId_position_key" ON "Zutat"("mahlzeitId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Ernaehrungsziel_vorschlagId_key" ON "Ernaehrungsziel"("vorschlagId");

-- CreateIndex
CREATE INDEX "Ernaehrungsziel_gesetztAm_idx" ON "Ernaehrungsziel"("gesetztAm");

-- Höchstens ein offener Vorschlag: die Spalte trägt den festen Wert 'offen',
-- solange entschieden werden muss, und NULL danach. Postgres lässt beliebig
-- viele NULL nebeneinander zu, aber nur ein einziges 'offen'. Damit
-- entscheidet die Datenbank, wer zuerst da war — nicht die Anwendung, die
-- beim gleichzeitigen Rendern zweier Seiten beide Male "noch keiner da" liest.
-- CreateIndex
CREATE UNIQUE INDEX "Kalorienvorschlag_offenSchluessel_key" ON "Kalorienvorschlag"("offenSchluessel");

-- CreateIndex
CREATE INDEX "Kalorienvorschlag_erstelltAm_idx" ON "Kalorienvorschlag"("erstelltAm");

-- AddForeignKey
ALTER TABLE "Zutat" ADD CONSTRAINT "Zutat_mahlzeitId_fkey" FOREIGN KEY ("mahlzeitId") REFERENCES "Mahlzeit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ernaehrungsziel" ADD CONSTRAINT "Ernaehrungsziel_vorschlagId_fkey" FOREIGN KEY ("vorschlagId") REFERENCES "Kalorienvorschlag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Jakobs Plan (Fitnessbell, Ernaehrungsplan.xlsx)
--
-- Die Schlüssel sind sprechend und fest vergeben statt als cuid erzeugt: so
-- ist an einer späteren Zeile sofort erkennbar, zu welcher Mahlzeit sie
-- gehört, und eine Korrektur am Plan lässt sich als UPDATE schreiben, ohne
-- vorher die ID nachschlagen zu müssen.
--
-- Essensfenster 05:20–18:00. Kreatin und Koffein laufen ohnehin und stehen
-- deshalb bewusst NICHT hier — eine Checkliste für etwas, das man sowieso
-- macht, erzeugt nur Abhaken ohne Erkenntnis.
-- ─────────────────────────────────────────────────────────────

INSERT INTO "Mahlzeit" ("id", "position", "name", "fenster") VALUES
    ('mahlzeit-1', 1, 'Meal 1', 'Frühstück'),
    ('mahlzeit-2', 2, 'Meal 2', 'Shake'),
    ('mahlzeit-3', 3, 'Meal 3', 'Pre'),
    ('mahlzeit-4', 4, 'Intra',  'Training'),
    ('mahlzeit-5', 5, 'Meal 4', 'Post'),
    ('mahlzeit-6', 6, 'Meal 5', 'Abend');

INSERT INTO "Zutat" ("id", "mahlzeitId", "position", "name", "menge", "einheit", "alternative") VALUES
    ('zutat-1-1', 'mahlzeit-1', 1, 'Reis',          150, 'g',   NULL),
    ('zutat-1-2', 'mahlzeit-1', 2, 'Rindertartar',  100, 'g',   NULL),
    ('zutat-1-3', 'mahlzeit-1', 3, 'Gemüse',        200, 'g',   NULL),
    ('zutat-1-4', 'mahlzeit-1', 4, 'Olivenöl',       10, 'g',   NULL),

    ('zutat-2-1', 'mahlzeit-2', 1, 'Haferflocken',  100, 'g',   NULL),
    ('zutat-2-2', 'mahlzeit-2', 2, 'Whey',           30, 'g',   NULL),
    ('zutat-2-3', 'mahlzeit-2', 3, 'Banane',          1, 'Stk', NULL),
    ('zutat-2-4', 'mahlzeit-2', 4, 'Ei roh',          2, 'Stk', NULL),

    ('zutat-3-1', 'mahlzeit-3', 1, 'Reispudding',   100, 'g',   NULL),
    ('zutat-3-2', 'mahlzeit-3', 2, 'Whey',           20, 'g',   NULL),
    ('zutat-3-3', 'mahlzeit-3', 3, 'Nussmus',        10, 'g',   NULL),
    ('zutat-3-4', 'mahlzeit-3', 4, 'Banane',          1, 'Stk', 'oder 250 g Beeren'),

    ('zutat-4-1', 'mahlzeit-4', 1, 'Maltodextrin',   40, 'g',   NULL),

    ('zutat-5-1', 'mahlzeit-5', 1, 'Reis',          150, 'g',   NULL),
    ('zutat-5-2', 'mahlzeit-5', 2, 'Hühnchen',      100, 'g',   NULL),
    ('zutat-5-3', 'mahlzeit-5', 3, 'Gemüse',        200, 'g',   NULL),
    ('zutat-5-4', 'mahlzeit-5', 4, 'Olivenöl',       10, 'g',   NULL),

    ('zutat-6-1', 'mahlzeit-6', 1, 'Magertopfen',   125, 'g',   NULL),
    ('zutat-6-2', 'mahlzeit-6', 2, 'Beeren',        200, 'g',   NULL),
    ('zutat-6-3', 'mahlzeit-6', 3, 'Haferflocken',  100, 'g',   NULL),
    ('zutat-6-4', 'mahlzeit-6', 4, 'Nüsse',          15, 'g',   NULL);

-- Ausgangsziel. quelle = 'plan' bedeutet ausdrücklich: übernommen, nicht
-- berechnet — und es setzt die Messuhr für den nächsten Coach-Vorschlag NICHT
-- zurück. Der Plan lief schon, bevor die App davon wusste; eine Wartezeit von
-- zehn Tagen ab heute wäre eine erfundene Frist.
INSERT INTO "Ernaehrungsziel"
    ("id", "gueltigAb", "kcal", "kohlenhydrateG", "eiweissG", "fettG", "quelle", "begruendung")
VALUES
    ('ziel-ausgang', DATE '2026-08-18', 3600, 560, 180, 65, 'plan',
     'Ausgangsplan von Fitnessbell, unverändert übernommen. Nicht von Kadenz berechnet.');
