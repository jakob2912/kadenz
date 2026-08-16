# Kadenz — MCP-Server

Gibt Claude Desktop Zugriff auf Trainings- und Gesundheitsdaten. Damit
übernimmt der Desktop die Rolle des Coaches — inklusive Rückfragen — und die
App braucht keinen eigenen Anthropic-API-Key.

Weil in Claude Desktop auch Obsidian angebunden ist, entsteht die Brücke in
beide Richtungen von selbst: eine Frage wie „wie war meine Woche?" kann
Trainingsdaten und Vault-Notizen zusammenbringen.

## Werkzeuge

| Werkzeug | Liefert |
|---|---|
| `regeneration_heute` | Score aus Schlaf, Tiefschlaf, Ruhepuls und HRV gegen die persönliche Baseline; dazu ob Krafttraining und Cardio vertretbar sind |
| `gewichtstrend` | Gewichtsreihe, 7-Tage-Schnitt, Trendurteil — inklusive der Aussage, wann der Trend **nicht** verwertbar ist |
| `training_heute` | Anstehende Einheit laut Rotation, mit Startgewichten aus der echten Historie und Begründung für jede Änderung |
| `trainingsverlauf` | Die letzten Einheiten aus der Datenbank, mit allen Sätzen |
| `satz_eintragen` | Einen Satz nachtragen, falls im Gym etwas vergessen wurde |

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

`regeneration_heute` und `gewichtstrend` brauchen Google-Daten. Der
Refresh-Token liegt normalerweise in einem httpOnly-Cookie, an das ein
separater Prozess nicht herankommt — deshalb legt der Login ihn zusätzlich in
der Tabelle `Einstellung` ab (Schlüssel `google_refresh_token`).

Wer sich vor Einführung dieser Ablage angemeldet hat, muss den Login einmal
wiederholen:

```
http://localhost:3000/api/auth/google
```

Fehlt der Token, sagen die betroffenen Werkzeuge das im Klartext statt
kommentarlos leer zu antworten. `training_heute`, `trainingsverlauf` und
`satz_eintragen` funktionieren auch ohne, sie brauchen nur die Datenbank.

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
