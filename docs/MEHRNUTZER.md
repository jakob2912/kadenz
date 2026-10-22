# Kadenz für andere öffnen — Einschätzung

Stand 22.10.2026. Frage: Kann Kadenz für andere Leute mit Google-/Fitbit-Uhr
zugänglich werden?

**Kurz:** Ja, aber es ist kein Schalter, sondern ein Umbau — und für
eine öffentliche App kommt Rechtliches dazu, das bei Gesundheitsdaten nicht
optional ist. Für eine Handvoll Freunde gibt es einen deutlich kürzeren Weg.

## Was heute an einer Person hängt

Kadenz ist von Grund auf für genau einen Menschen gebaut. Das ist kein
Mangel, sondern der Grund, warum es so gut passt — aber es steckt überall:

| Stelle | Was festgelegt ist |
|---|---|
| Datenmodell (`prisma/schema.prisma`) | Keine Tabelle kennt einen Nutzer. Workouts, Sätze, Ziele, Trainingsmax, Push-Abos gehören implizit Jakob. |
| Google-Zugang (`Einstellung.google_refresh_token`) | Genau ein Refresh-Token für die ganze App. |
| Gewichtsplan (`src/lib/gewichtsplan.ts`) | Phasen bis 100 kg, verankert am 25.08.2026 bei 82,5 kg — als Konstante im Code. |
| Schulzeit/Ferien (`SCHULSTART` in `coach.ts`) | Jakobs Schuljahr. |
| Trainingsplan (`plan.ts`, `wochenplan.ts`) | Push/Pull-Rotation mit festen Tagen, eingeschobene Pausen als Datumsliste. |
| Bankdrücken 5/3/1 (`kraft.ts`, `bank.ts`) | Ein Programm für eine Übung, mit Jakobs Regeln (Deload ab 100 kg TM, Testzyklus). |
| Ernährung (`Mahlzeit`, `Zutat`) | Ein Fitnessbell-Plan. |
| Texte | „Guten Morgen, Jakob“, Begründungen in der Du-Form über seine Technik. |

## Drei Wege

### A) Eigene Kopie je Person — für 2–5 Freunde

Jeder bekommt seine eigene Kadenz: Fork des Repos, eigenes Vercel-Projekt,
eigene Supabase, eigenes Google-Cloud-Projekt mit sich selbst als Testnutzer.

- **Code-Aufwand:** klein. Die festen Werte (Name, Gewichtsplan, Schulstart,
  Plan) wandern in eine Konfigurationsdatei oder in die Tabelle
  `Einstellung`, dazu eine Einrichtungsseite. Grob ein bis zwei Abende.
- **Kosten:** 0 € — alles in den Gratis-Tarifen.
- **Haken:** Jemand muss es pro Person einrichten (rund eine Stunde mit
  Anleitung). Updates laufen über „Sync fork“ auf GitHub.
- **Recht:** unkritisch — jeder hat seine Daten in seinem eigenen Konto.

### B) Eine Instanz, mehrere Konten — für einen kleinen Kreis

Eine Kadenz, Anmeldung mit Google, jeder sieht nur seine Daten.

- **Code-Aufwand:** groß. Nutzer-Tabelle; `userId` an jeder Tabelle und in
  jeder Abfrage (über 20 Dateien in `src/lib`); Google-Token je Nutzer;
  Gewichtsplan, Trainingsplan, Übungskatalog und Ernährung als Daten mit
  Bearbeitungsoberfläche statt als Code; MCP-Server mit Nutzerbezug.
  Realistisch mehrere Wochenenden.
- **Google:** Solange das OAuth-Projekt im Testmodus steht, bis zu 100
  namentlich eingetragene Testnutzer — und deren Verbindung läuft wie bei
  Jakob **alle 7 Tage** ab.
- **Recht:** Sobald Kadenz Gesundheitsdaten anderer Leute speichert, ist
  Jakob nach DSGVO dafür verantwortlich (Art. 9: Gesundheitsdaten sind
  besonders geschützt). Für Freunde im privaten Kreis vertretbar mit klarer
  Einwilligung, aber nicht nichts.

### C) Öffentliche App

Wie B, zusätzlich:

- **Google-Verifizierung** der Fitness-/Health-Scopes: Datenschutzerklärung,
  verifizierte Domain, Prüfung durch Google, je nach Scope ein externes
  Sicherheitsaudit (kostet Geld, oft vierstellig). Erst danach entfällt der
  7-Tage-Ablauf und die 100-Nutzer-Grenze.
- **Vercel Hobby** ist nur für nicht-kommerzielle Nutzung erlaubt; bei
  Wachstum Pro-Tarif (20 $/Monat) und Supabase Pro (25 $/Monat).
- **DSGVO** vollständig: Verarbeitungsverzeichnis, Auftragsverarbeitungs-
  verträge mit Vercel/Supabase, Löschkonzept, Datenschutzerklärung,
  Impressum.
- **Produkt:** Kadenz' Stärke sind Jakobs Regeln. Für Fremde braucht es
  einen Einstieg, der Plan, Ziele und Programm abfragt — sonst ist es eine
  App für jemanden, der man nicht ist.

## Empfehlung

Mit **A** anfangen: Wer aus dem Freundeskreis wirklich will, bekommt eine
eigene Kopie. Das zeigt mit null Kosten und null Rechtsrisiko, ob andere
Kadenz überhaupt nutzen. Erst wenn das trägt, lohnt **B** — und **C** nur,
wenn daraus ein echtes Projekt werden soll.

Der erste Schritt für A ist derselbe, der später auch B braucht: die festen
Werte aus dem Code in Daten verschieben. Er ist also in keinem Fall verloren.
