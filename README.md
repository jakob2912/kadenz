# Kadenz

Persönlicher Trainings- und Ernährungscoach: Push/Pull-Split mit Progression,
Bankdrücken nach 5/3/1, Regeneration aus Google Health (Fitbit), Gewichtsplan
und Kalorienziel. Next.js 16 auf Vercel, Postgres bei Supabase, dazu ein
MCP-Server für Claude Desktop (siehe [mcp/README.md](mcp/README.md)).

## Aufs iPhone — als App, kostenlos

Kadenz ist eine installierbare Web-App (PWA). Auf dem iPhone ist das der
einzige Weg zu einer App ohne App Store, der nichts kostet **und** dauerhaft
hält:

1. Die Vercel-Adresse in **Safari** öffnen (nicht Chrome).
2. **Teilen** tippen (seit iOS 26 hinter **•••**), dann **„Zum Home-Bildschirm“**.
3. Kadenz ab jetzt vom Home-Bildschirm starten. Läuft ohne Browser-Leiste,
   mit eigenem Icon, eigenem Fenster im App-Umschalter.
4. In Kadenz: Zahnrad oben rechts auf der Startseite → **Benachrichtigungen
   auf diesem Gerät einschalten** → erlauben → „Testnachricht“.

Ist ein Passwort gesetzt (siehe unten), meldet sich die installierte App
einmal neu an — sie hat einen eigenen Cookie-Speicher, getrennt von Safari.

### Warum keine „echte“ native App

Geprüft, und für den Fall „nur für mich, kostenlos“ schlechter als die PWA:

| Weg | Kosten | Haltbarkeit | Push-Nachrichten |
|---|---|---|---|
| **PWA (so wie jetzt)** | 0 € | dauerhaft | ja (ab iOS 16.4) |
| Xcode + kostenlose Apple-ID (z. B. mit Capacitor verpackt) | 0 €, braucht einen Mac | **läuft nach 7 Tagen ab**, jede Woche neu aufspielen | **nein** — Push braucht ein bezahltes Entwicklerkonto |
| AltStore / SideStore | 0 € | 7 Tage, muss laufend neu signiert werden | nein |
| Apple Developer Program (TestFlight) | 99 €/Jahr | dauerhaft | ja |

Die PWA kann alles, was Kadenz braucht: Home-Bildschirm, Vollbild,
Push-Nachrichten, Bildschirm anlassen, offline weiterloggen.

## Was die App auf dem Handy kann

- **Satzpause**, die bei gesperrtem Bildschirm richtig weiterläuft und ein
  Neuladen übersteht; am Ende zwei Töne (wenn Kadenz offen ist) und eine
  Push-Nachricht (wenn das Handy gesperrt ist).
- **Offline loggen**: ohne Netz abgehakte Sätze bleiben auf dem Handy und
  gehen raus, sobald wieder Empfang da ist — auch wenn iOS die App
  zwischendurch beendet. Jeder Satz trägt die Uhrzeit, zu der er abgehakt
  wurde.
- **Benachrichtigungen**: Satzpause vorbei · Morgen-Briefing (Regeneration,
  heutige Einheit, ob das Gewicht fehlt, ob Google neu verbunden werden muss)
  · Abend-Erinnerung (nur wenn die geplante Einheit noch offen ist oder ein
  Kalorienvorschlag wartet). Einzeln abschaltbar unter Einstellungen.
- **Bestwerte** werden beim Abhaken markiert (schwerstes Gewicht,
  geschätztes Maximum, lange AMRAP-Sätze); beim offenen AMRAP-Satz steht,
  ab wie vielen Wiederholungen es ein Bestwert wäre. Vor dem Bankdrücken
  gibt es eine **Aufwärmtreppe**.
- **Notizen**: je Übung (bleibt fürs nächste Mal stehen, etwa „Sitz Stufe 4“)
  und je Einheit. Eine Einheit lässt sich auch **vorzeitig beenden**, wenn
  eine Übung ausfällt.
- **Logger fürs Gym**: Plus/Minus für Gewicht und Wiederholungen, Rahmen um
  die Übung, die dran ist, Fortschrittsbalken, Weiterrücken zur nächsten
  Übung; Satz dazu oder weglassen, Übung nur heute oder dauerhaft tauschen;
  nach jedem Satz kurz „Noch drin?“ (Wiederholungen in Reserve), was die
  Progression mitrechnet.
- **Zahl am App-Symbol**: wie viele Dinge heute offen sind — die geplante
  Einheit, solange sie nicht begonnen hat, und ein wartender
  Kalorienvorschlag.
- **Verlauf**: Trainingskalender über zwölf Wochen, Serie, jede Einheit mit
  allen Sätzen und Notiz; **CSV-Export** aller Sätze unter Einstellungen.
  Diagramme sind antippbar (Wert und Datum) und zeigen 30 Tage, 90 Tage oder
  ein Jahr — Gewicht, Schlaf, Ruhepuls, HRV und das geschätzte Maximum je
  Übung. Bankdrücken steht als zweite Ansicht unter Verlauf.
- **Eigene Ablage der Google-Werte**: Schlaf, Ruhepuls, HRV und Gewicht
  liegen zusätzlich in der eigenen Datenbank (beim ersten Aufruf wird ein
  Jahr nachgeholt). Läuft die Google-Verbindung ab, zeigt Kadenz die Werte
  bis zur letzten Nacht weiter an, und ein eingetragenes Morgengewicht geht
  nicht verloren.

## Umgebungsvariablen (Vercel → Settings → Environment Variables)

| Variable | Pflicht | Wofür |
|---|---|---|
| `DATABASE_URL`, `DIRECT_URL` | ja | Supabase: Pool (6543) zur Laufzeit, direkt (5432) für Migrationen |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ja | Google Health (Schlaf, Ruhepuls, HRV, Gewicht) |
| `KADENZ_PASSWORT` | empfohlen | Schützt die ganze App mit einem Passwort. **Ohne sie ist Kadenz für jeden offen, der die Adresse kennt** — inklusive Gesundheitsdaten und Schreibzugriff |
| `CRON_SECRET` | für Morgen/Abend-Nachricht | Beliebige lange Zufallszeichenkette; Vercel schickt sie beim Cron-Aufruf mit |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | nein | Nur wenn man die Push-Schlüssel selbst vorgeben will. Ohne sie legt Kadenz ein Paar in der Datenbank an |

Nach dem Setzen einmal neu deployen.

### Grenzen im Gratis-Tarif von Vercel

- **Cron-Jobs** laufen im Hobby-Tarif einmal am Tag und irgendwann innerhalb
  der eingetragenen Stunde. Die Zeiten in `vercel.json` stehen in UTC:
  Morgen 05:xx UTC (6–7 Uhr in Wien, Sommerzeit 7–8), Abend 16:xx UTC
  (17–18 Uhr, Sommerzeit 18–19).
- Die **Satzpausen-Nachricht** wartet in einer laufenden Funktion bis zum
  Pausenende. Das braucht Fluid Compute (bei Projekten seit 2025 Standard,
  auch gratis; Vercel → Settings → Functions). Ohne fällt nur diese eine
  Nachricht still aus, der Timer in der App läuft unverändert.

## Entwicklung

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # vitest
npm run lint
```

`.env.local` braucht mindestens `DATABASE_URL` und `DIRECT_URL`. Migrationen
laufen auf Vercel nur im Produktions-Build (`scripts/build.sh`), lokal mit
`npx prisma migrate deploy`.

Push lokal testen: `next dev --experimental-https`, im Browser die
Benachrichtigungen erlauben, dann unter `/einstellungen` einschalten.
