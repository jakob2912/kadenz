-- CreateTable
CREATE TABLE "Einstellung" (
    "schluessel" TEXT NOT NULL,
    "wert" TEXT NOT NULL,
    "aktualisiert" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Einstellung_pkey" PRIMARY KEY ("schluessel")
);
