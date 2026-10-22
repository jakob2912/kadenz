-- Push-Abos je Gerät
--
-- Für die Benachrichtigungen (Satzpause vorbei, Morgen-Briefing,
-- Trainings-Erinnerung). Die Schlüssel p256dh und auth verschlüsseln die
-- Nachricht für genau dieses Gerät — wer sie hat, kann Jakob Nachrichten
-- schicken, die aussehen wie von Kadenz. Deshalb wie jede Tabelle seit
-- 20260916090000_rls_und_rechte: RLS an, keine Policy, und die
-- Standardrechte für anon/authenticated sind dort schon entzogen.

CREATE TABLE "PushAbo" (
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "geraet" TEXT,
    "angelegt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "zuletztZugestellt" TIMESTAMP(3),

    CONSTRAINT "PushAbo_pkey" PRIMARY KEY ("endpoint")
);

ALTER TABLE "PushAbo" ENABLE ROW LEVEL SECURITY;
