#!/usr/bin/env bash
#
# Kadenz — Build auf Vercel
#
# Vercel führt von sich aus nur `prisma generate` aus (postinstall in
# package.json). Migrationen liefen bis hierher von Hand von Jakobs Rechner:
# `npx prisma migrate deploy`, vor jedem Deployment, das eine brauchte. Das ging
# genau so lange gut, wie er daran dachte. Vergisst er es einmal, läuft neuer
# Code gegen ein altes Schema — und das sieht in der App nicht nach einer
# fehlenden Spalte aus, sondern nach einer kaputten Seite.
#
# Warum hier und nicht im "build"-Skript von package.json: dort liefe die
# Migration auch bei jedem lokalen `npm run build` — also von einem Laptop aus
# gegen die produktive Datenbank, nur weil jemand den Build prüfen wollte.
# Lokal soll ein Build nichts verändern.
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Migrationen — nur in der Produktion
# ─────────────────────────────────────────────────────────────
#
# Preview und Production zeigen auf dieselbe Supabase (dasselbe DIRECT_URL für
# beide Umgebungen). Ohne diese Bedingung würde der Preview-Build eines
# Feature-Branches die produktive Datenbank migrieren — mit einer Migration,
# über die noch niemand entschieden hat, und während der laufende Produktions-
# code sie nicht kennt.
#
# Der Preis: ein Preview-Deployment läuft mit dem Schema, das gerade in der
# Produktion steht. Braucht der Branch eine neue Spalte, ist die Vorschau
# kaputt. Das ist die richtige Richtung — eine kaputte Vorschau kostet einen
# Klick, eine ungewollt migrierte Produktionsdatenbank einen Abend.
#
# Reihenfolge mit Absicht: erst migrieren, dann bauen. Schlägt die Migration
# fehl, bricht `set -e` den Build ab und es wird gar nichts ausgeliefert — statt
# neuen Code auf ein Schema zu setzen, das ihn nicht trägt.
#
# Was das offen lässt: zwischen der Migration und dem Umschalten auf das neue
# Deployment bedient der ALTE Code das neue Schema, ein bis zwei Minuten lang.
# Hinzugefügte Spalten und Tabellen hält er aus, weil er sie nicht kennt.
# Umbenennen und Löschen hält er nicht aus — solche Schritte gehören in zwei
# Deployments geteilt: erst hinzufügen und doppelt schreiben, nach dem Umstieg
# das Alte entfernen.
if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "→ prisma migrate deploy (VERCEL_ENV=production)"
  npx prisma migrate deploy
else
  echo "→ Migrationen übersprungen (VERCEL_ENV=${VERCEL_ENV:-nicht gesetzt}, nicht production)"
fi

npx next build
