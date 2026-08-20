# Kadenz — MCP-Server

Gibt Claude Desktop Zugriff auf Trainings- und Gesundheitsdaten. Damit
übernimmt der Desktop die Rolle des Coaches — inklusive Rückfragen — und die
App braucht keinen eigenen Anthropic-API-Key.

Weil in Claude Desktop auch Obsidian angebunden ist, entsteht die Brücke in
beide Richtungen von selbst: eine Frage wie „wie war meine Woche?" kann
Trainingsdaten und Vault-Notizen zusammenbringen.

## Werkzeuge

### Gesundheit

| Werkzeug | Liefert |
|---|---|
| `regeneration_heute` | Score aus Schlaf, Tiefschlaf, Ruhepuls und HRV gegen die persönliche Baseline; dazu ob Krafttraining und Cardio vertretbar sind |
| `briefing_heute` | Wie die Nacht war, die Freigabe für heute und konkrete Verbesserungsvorschläge. Jeder Vorschlag hängt an einem gemessenen Wert — liegt keiner daneben, ist die Liste leer. Derselbe Text steht auf der Startseite |
| `gewichtstrend` | Gewichtsreihe, 7-Tage-Schnitt, Trendurteil — inklusive der Aussage, wann der Trend **nicht** verwertbar ist |

### Training

| Werkzeug | Liefert |
|---|---|
| `training_heute` | Anstehende Einheit laut Rotation, mit Startgewichten aus der echten Historie, Begründung für jede Änderung und dem Stand des Bankprogramms |
| `trainingsverlauf` | Die letzten Einheiten aus der Datenbank, mit allen Sätzen |
| `satz_eintragen` | Einen Satz nachtragen, falls im Gym etwas vergessen wurde |
| `kraftfortschritt` | Geschätztes Maximum je Übung (Epley), Bestleistung und Urteil, ob es steigt. Ohne Übungsname die Rangliste aller Übungen — aufsteigend, was hängt steht oben |

### Ernährung

| Werkzeug | Liefert |
|---|---|
| `ernaehrungsplan` | Die Mahlzeiten aus dem Fitnessbell-Plan mit Zutaten und Mengen, dazu das gültige Kalorien- und Makroziel. Die Makros sind Tagessummen, nicht je Mahlzeit |
| `kalorienziel` | Das aktuelle Ziel, die Historie (wann wurde was warum gesetzt) und ein eventuell offener Vorschlag |
| `kalorienvorschlag_pruefen` | Prüft, ob das Ziel angepasst gehört, und legt bei Bedarf einen Vorschlag an. Sagt auch, **warum gerade nichts** vorzuschlagen ist — etwa weil der Gewichtstrend nach einer Messlücke nicht verwertbar ist |

Hier wird bewusst nur gelesen und vorgeschlagen: **kein Werkzeug setzt das
Kalorienziel.** Ein Werkzeugaufruf ist Jakobs Ja nicht, auch dann nicht, wenn er
im Chat zustimmt. Das Ziel ändert sich ausschließlich über die Ja-Taste in der
App — `kalorienvorschlag_pruefen` legt nur den Vorschlag hin, den sie beantwortet.

### Übungskatalog

Der Split steht seit August 2026 in der Datenbank, nicht mehr als Konstante im
Quelltext. Eine Übung zu tauschen braucht damit kein Deployment mehr.

| Werkzeug | Liefert |
|---|---|
| `uebungen_lesen` | Der aktuelle Split: Push und Pull mit Reihenfolge, Notizen und Referenzgewichten |
| `uebung_tauschen` | Ersetzt eine Übung und behält deren Platz |
| `uebung_hinzufuegen` | Nimmt eine Übung auf, wahlweise an einer bestimmten Stelle |
| `uebung_entfernen` | Nimmt eine Übung heraus und schließt die Lücke |
| `uebung_umbenennen` | Benennt um **und schreibt die geloggten Sätze mit um** |
| `uebungen_umsortieren` | Setzt die Reihenfolge neu; die Liste muss alle Übungen der Einheit nennen |

Warum hier geschrieben werden darf, beim Kalorienziel aber nicht: eine Übung
tauschen, weil das Gerät belegt ist, ist genau die Entscheidung, die im
Gespräch fällt. Ein falsch getauschtes Gerät ist zudem in einem Aufruf wieder
zurückgenommen — ein falsch gesetztes Kalorienziel läuft zehn Tage mit, bevor
es überhaupt auffällt.

`uebung_umbenennen` ist das einzige Werkzeug, das die Historie anfasst, und
genau dafür ist es da: `SetLog.exercise` hält den Übungsnamen als Text ohne
Fremdschlüssel. Wird nur der Katalog umgeschrieben, hängen die alten Sätze
verwaist unter dem alten Namen — die Übung sähe im Kraftverlauf aus, als hätte
sie nie stattgefunden, und die Trainingsseite schlüge wieder die
Referenzgewichte vor. Beides läuft in einer Transaktion.

### Bankdrücken 5/3/1

| Werkzeug | Liefert |
|---|---|
| `bank_plan_heute` | Zyklus, Programmwoche, Trainingsmax und die drei Sätze mit Gewicht |
| `bank_trainingsmax` | Der aktuelle Trainingsmax samt Historie — jeder Zyklus mit Begründung |
| `bank_tm_setzen` | Setzt den Trainingsmax; zum Einstieg nötig, danach nur noch als Korrektur |

Bank-Tag ist **jede zweite Push-Einheit**, also alle sechs Tage; ein Zyklus
dauert damit 24 Tage. Gezählt wird ab dem Tag, an dem der Trainingsmax gesetzt
wurde, nicht ab dem Rotationsanker — sonst begänne die erste Bankeinheit
mitten im Zyklus.

Den ersten Trainingsmax schätzt Kadenz **nicht**: Langhantel-Bankdrücken hat in
dieser App keine Historie, und ein geratener Startwert wäre die Grundlage
sämtlicher Prozente des Programms gewesen. Danach schreibt Kadenz ihn nach
jedem Zyklus aus dem AMRAP-Satz selbst fort.

## Einrichtung in Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` öffnen und
unter `mcpServers` ergänzen:

```json
{
  "mcpServers": {
    "kadenz": {
      "command": "node",
      "args": [
        "--env-file=/Users/jakobseidl/Documents/Claude/personal-trainer-app/kadenz/.env.local",
        "/Users/jakobseidl/Documents/Claude/personal-trainer-app/kadenz/node_modules/.bin/tsx",
        "/Users/jakobseidl/Documents/Claude/personal-trainer-app/kadenz/mcp/server.ts"
      ]
    }
  }
}
```

Danach Claude Desktop neu starten.

Die Pfade sind absolut, weil Claude Desktop den Server ohne definiertes
Arbeitsverzeichnis startet. `--env-file` liefert die Zugangsdaten für
Datenbank und Google — der Server liest sonst nichts aus der Umgebung.

## Voraussetzung: Refresh-Token in der Datenbank

`regeneration_heute`, `briefing_heute` und `gewichtstrend` brauchen
Google-Daten. Der
Refresh-Token liegt normalerweise in einem httpOnly-Cookie, an das ein
separater Prozess nicht herankommt — deshalb legt der Login ihn zusätzlich in
der Tabelle `Einstellung` ab (Schlüssel `google_refresh_token`).

Wer sich vor Einführung dieser Ablage angemeldet hat, muss den Login einmal
wiederholen:

```
http://localhost:3000/api/auth/google
```

Fehlt der Token, sagen die betroffenen Werkzeuge das im Klartext statt
kommentarlos leer zu antworten. Alles rund um Training, Übungskatalog,
Kraftfortschritt und Bankdrücken funktioniert auch ohne — es braucht nur die
Datenbank.

## Testen ohne Claude Desktop

```bash
printf '%s\n' \
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
'{"jsonrpc":"2.0","method":"notifications/initialized"}' \
'{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
| node --env-file=.env.local ./node_modules/.bin/tsx mcp/server.ts
```

## Warum tsx statt node

Die Module der App importieren sich gegenseitig ohne Dateiendung. Nexts
Bundler löst das auf, Nodes ESM-Lader nicht. `tsx` übernimmt beides —
TypeScript und die Auflösung — ohne dass die App umgeschrieben werden muss.

Aus demselben Grund steht am Ende von `server.ts` kein Top-Level-`await`: das
Projekt setzt keinen Modultyp, tsx übersetzt daher nach CommonJS, und dort ist
es nicht erlaubt.
