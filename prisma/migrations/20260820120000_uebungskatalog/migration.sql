-- Übungskatalog in der Datenbank und Trainingsmax fürs Bankdrücken.
--
-- Bis hierher stand der Split als Konstante SESSIONS in src/lib/plan.ts. Eine
-- Übung tauschen — Gerät belegt, Schulter zwickt — brauchte damit ein
-- Deployment. Der Design-Prototyp hatte "Übung tauschen" in der Fußzeile jeder
-- Übung und als Coach-Vorschlag vorgesehen; es fiel bei der Umsetzung weg,
-- wie zuvor schon der Ernährungsplan.
--
-- Die Zeilen am Ende sind keine Testdaten: es ist Jakobs tatsächlicher Split
-- aus dem Kraftwerte-Log (29.07.2026) und den Lift-Off-Screenshots
-- (16.08.2026), wortgleich aus SESSIONS übernommen. Am Tag der Migration
-- ändert sich damit nichts — außer dass Bankdrücken dazukommt.
--
-- Die Schlüssel sind sprechend vergeben statt als cuid erzeugt, wie schon bei
-- den Mahlzeiten: eine Korrektur lässt sich dann als UPDATE schreiben, ohne
-- vorher die ID nachzuschlagen.

-- CreateTable
CREATE TABLE "Uebung" (
    "id" TEXT NOT NULL,
    "einheit" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "notiz" TEXT,
    "programm" TEXT,
    "startKg" DOUBLE PRECISION,
    "startWdh" INTEGER[],

    CONSTRAINT "Uebung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTrainingsmax" (
    "id" TEXT NOT NULL,
    "zyklus" INTEGER NOT NULL,
    "gueltigAb" DATE NOT NULL,
    "tmKg" DOUBLE PRECISION NOT NULL,
    "quelle" TEXT NOT NULL,
    "begruendung" TEXT NOT NULL,
    "gesetztAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTrainingsmax_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Uebung_einheit_position_key" ON "Uebung"("einheit", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Uebung_einheit_name_key" ON "Uebung"("einheit", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BankTrainingsmax_zyklus_key" ON "BankTrainingsmax"("zyklus");

-- CreateIndex
CREATE INDEX "BankTrainingsmax_gesetztAm_idx" ON "BankTrainingsmax"("gesetztAm");

-- ─────────────────────────────────────────────────────────────
-- Push · Brust, Schulter, Trizeps, Quads
--
-- Bankdrücken steht neu auf Platz 1 und schiebt Incline Chest Press auf 2.
-- Es hat bewusst kein startKg: Langhantel-Bankdrücken hat in dieser App keine
-- Historie, und ein geratener Startwert wäre die Grundlage für alle Prozente
-- des 5/3/1 gewesen. Der Trainingsmax wird einmalig eingetragen, nicht
-- geschätzt — solange er fehlt, sagt die Trainingsseite das.
-- ─────────────────────────────────────────────────────────────

INSERT INTO "Uebung" ("id", "einheit", "position", "name", "notiz", "programm", "startKg", "startWdh") VALUES
    ('uebung-push-1', 'push', 1, 'Bankdrücken',          'Langhantel, Flachbank — Sätze und Gewichte gibt der 5/3/1-Zyklus vor', '531', NULL,  '{}'),
    ('uebung-push-2', 'push', 2, 'Incline Chest Press',  'Maschine',                        NULL,  100,   '{5,4}'),
    ('uebung-push-3', 'push', 3, 'Butterfly',            'Form laut dir verbesserungswürdig', NULL,   85,   '{7,6}'),
    ('uebung-push-4', 'push', 4, 'Shoulder Press',       'Maschine',                        NULL,  100,   '{6,5}'),
    ('uebung-push-5', 'push', 5, 'Seitheben',            'Maschine, unilateral',            NULL,   37.5, '{8,7}'),
    ('uebung-push-6', 'push', 6, 'Trizeps-Pushdown',     'Cuff am Kabelturm',               NULL,   20,   '{5,5}'),
    ('uebung-push-7', 'push', 7, 'Hex Squat',            'nur 1 Satz',                      NULL,   95,   '{7}'),
    ('uebung-push-8', 'push', 8, 'Leg Extension',        NULL,                              NULL,   90,   '{7,6}'),
    ('uebung-push-9', 'push', 9, 'Calf Raise',           'Slab Press',                      NULL,  130,   '{6,5}');

-- ─────────────────────────────────────────────────────────────
-- Pull · Rücken, Bizeps, Hamstrings
-- ─────────────────────────────────────────────────────────────

INSERT INTO "Uebung" ("id", "einheit", "position", "name", "notiz", "programm", "startKg", "startWdh") VALUES
    ('uebung-pull-1', 'pull', 1, 'Iso-Lateral Row',      'Maschine, unilateral', NULL,  50,  '{6,5}'),
    ('uebung-pull-2', 'pull', 2, 'Lat Pulldown',         'zur Brust ziehen',     NULL,  95,  '{6,5}'),
    ('uebung-pull-3', 'pull', 3, 'T Bar Row',            NULL,                   NULL,  60,  '{5,4}'),
    ('uebung-pull-4', 'pull', 4, 'Machine Reverse Fly',  NULL,                   NULL,  55,  '{7,6}'),
    ('uebung-pull-5', 'pull', 5, 'Preacher Curl',        NULL,                   NULL,  20,  '{6,5}'),
    ('uebung-pull-6', 'pull', 6, 'Leg Curl',             NULL,                   NULL, 125,  '{7,6}'),
    ('uebung-pull-7', 'pull', 7, 'Stiff-Leg-Deadlift',   NULL,                   NULL, 100,  '{8,7}'),
    ('uebung-pull-8', 'pull', 8, 'Crunch (Maschine)',    NULL,                   NULL,  70,  '{5,5}');
