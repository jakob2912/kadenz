import { de, kurzDatum } from "@/components/ui";

export type Reihenpunkt = { datum: string; wert: number };

/**
 * Schlichter Linienchart. Messlücken werden nicht überbrückt, sondern gezeigt.
 *
 * Stand als GewichtsChart in der Verlaufsseite und war fest auf Kilogramm
 * verdrahtet. Der Kraftverlauf braucht dieselbe Kurve für das geschätzte
 * Maximum je Übung — und ein zweites Inline-SVG daneben hätte bedeutet, jede
 * Korrektur an der Achsenbeschriftung oder der Lückenlogik zweimal zu machen.
 */
export function ReihenChart({
  reihe,
  soll,
  sollBezeichnung = "Plan",
  einheit = "kg",
  lueckeTage = 3,
  leer,
  einzeln,
  bezeichnung = "Verlauf",
}: {
  reihe: Reihenpunkt[];
  /**
   * Die geplante Kurve, gestrichelt hinter der gemessenen.
   *
   * Getrennt und nicht als zweite Reihe im selben Feld: die beiden bedeuten
   * Verschiedenes. Die eine ist gemessen, die andere ausgedacht, und das muss
   * man ihnen ansehen — sonst liest man den Plan irgendwann als Tatsache.
   * Deshalb gestrichelt, blasser und ohne Messpunkte.
   */
  soll?: Reihenpunkt[];
  /** Beschriftung der Soll-Linie in der Legende. */
  sollBezeichnung?: string;
  einheit?: string;
  /** Ab wie vielen Tagen ohne Wert die Linie getrennt wird. */
  lueckeTage?: number;
  /** Was dasteht, solange gar nichts vorliegt. */
  leer: string;
  /** Was dasteht, wenn nur ein einziger Punkt vorliegt. */
  einzeln: string;
  /** Für die Bildbeschreibung: "Gewichtsverlauf", "Kraftverlauf Bankdrücken". */
  bezeichnung?: string;
}) {
  if (reihe.length < 2) {
    return <p className="mt-4 text-sm leading-relaxed text-fg-dim">{reihe.length === 0 ? leer : einzeln}</p>;
  }

  const VW = 340;
  const VH = 170;
  const P = 32;

  const sollReihe = soll ?? [];

  /* Achsen über BEIDE Reihen. Ohne das liefe die Soll-Linie oben und rechts
     aus dem Bild, sobald der Plan über den gemessenen Bereich hinausgeht —
     und genau das tut er, das ist sein Zweck. */
  const werte = [...reihe, ...sollReihe].map((r) => r.wert);

  /* Der Rand war fest ±1 kg — beim Körpergewicht passt das, beim geschätzten
     Maximum einer Übung mit 30 kg Spanne wäre die Kurve gegen die Ränder
     geklebt. Anteilig, aber nie unter einer Einheit, damit eine flache Reihe
     nicht auf eine Linie zusammenfällt. */
  const spanne = Math.max(...werte) - Math.min(...werte);
  const rand = Math.max(1, spanne * 0.15);
  const lo = Math.floor(Math.min(...werte) - rand);
  const hi = Math.ceil(Math.max(...werte) + rand);

  const alleDaten = [...reihe, ...sollReihe].map((r) => Date.parse(r.datum));
  const t0 = Math.min(...alleDaten);
  const t1 = Math.max(...alleDaten);
  const x = (d: string) => P + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (VW - P - 14);
  const y = (wert: number) => VH - 24 - ((wert - lo) / (hi - lo || 1)) * (VH - 46);

  const segmente: Reihenpunkt[][] = [[]];
  reihe.forEach((p, i) => {
    if (i > 0 && Date.parse(p.datum) - Date.parse(reihe[i - 1].datum) > lueckeTage * 864e5) {
      segmente.push([]);
    }
    segmente[segmente.length - 1].push(p);
  });

  const erste = reihe[0];
  const letzte = reihe[reihe.length - 1];

  const diagramm = (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="mt-4 block h-[170px] w-full"
      role="img"
      aria-label={
        `${bezeichnung} von ${de(erste.wert, 1)} ${einheit} am ${kurzDatum(erste.datum)} ` +
        `auf ${de(letzte.wert, 1)} ${einheit} am ${kurzDatum(letzte.datum)}` +
        (sollReihe.length > 1
          ? `. Gestrichelt daneben ${sollBezeichnung}: ${de(sollReihe[0].wert, 1)} ${einheit} ` +
            `am ${kurzDatum(sollReihe[0].datum)} auf ` +
            `${de(sollReihe[sollReihe.length - 1].wert, 1)} ${einheit} am ` +
            `${kurzDatum(sollReihe[sollReihe.length - 1].datum)}.`
          : "")
      }
    >
      {[lo, (lo + hi) / 2, hi].map((g) => (
        <g key={g}>
          <line x1={P} y1={y(g)} x2={VW - 14} y2={y(g)} stroke="var(--color-hair-soft)" />
          <text x="0" y={y(g) + 3.5} className="fill-fg-faint text-[10px] font-semibold">
            {de(g, 0)}
          </text>
        </g>
      ))}

      {/* Zuerst der Plan, damit die gemessene Linie darüber liegt: wo beide
          zusammenfallen, soll die Tatsache gewinnen, nicht die Absicht. */}
      {sollReihe.length > 1 && (
        <path
          d={`M ${sollReihe.map((p) => `${x(p.datum)} ${y(p.wert)}`).join(" L ")}`}
          fill="none"
          stroke="var(--color-fg-faint)"
          strokeWidth="1.6"
          strokeDasharray="4 4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
        />
      )}

      {reihe.map((p) => (
        <circle key={p.datum} cx={x(p.datum)} cy={y(p.wert)} r="1.9" className="fill-fg-faint opacity-50" />
      ))}

      {segmente
        .filter((s) => s.length > 1)
        .map((seg, i) => (
          <path
            key={i}
            d={`M ${seg.map((p) => `${x(p.datum)} ${y(p.wert)}`).join(" L ")}`}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

      <circle
        cx={x(letzte.datum)}
        cy={y(letzte.wert)}
        r="4.5"
        fill="var(--color-accent)"
        stroke="var(--color-ground)"
        strokeWidth="3"
      />

      {/* Die Kurve hatte keine Zeitachse: dass links April und rechts August
          steht, war ihr nicht anzusehen, und eine Messlücke sah aus wie ein
          gleichmäßiger Abstand.

          Beschriftet wird die tatsächliche Spanne des Bildes, nicht die der
          Messreihe — mit einer Planlinie reicht die Achse weiter nach rechts
          als die letzte Messung, und dort stünde sonst ein Datum, das gar
          nicht am rechten Rand liegt. */}
      <text x={P} y={VH - 4} className="fill-fg-faint text-[10px] font-semibold">
        {kurzDatum(new Date(t0).toISOString().slice(0, 10))}
      </text>
      <text x={VW - 14} y={VH - 4} textAnchor="end" className="fill-fg-faint text-[10px] font-semibold">
        {kurzDatum(new Date(t1).toISOString().slice(0, 10))}
      </text>
    </svg>
  );

  /* Ohne Legende ist eine gestrichelte Linie nur eine zweite Linie. Sie steht
     als Text daneben und nicht im SVG: so wird sie mitgelesen, mitgesucht und
     skaliert mit der Schriftgröße des Systems. */
  if (sollReihe.length < 2) return diagramm;

  return (
    <>
      {diagramm}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-fg-faint">
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden className="shrink-0">
            <line x1="0" y1="2" x2="16" y2="2" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          gemessen
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden className="shrink-0">
            <line
              x1="0"
              y1="2"
              x2="16"
              y2="2"
              stroke="var(--color-fg-faint)"
              strokeWidth="1.6"
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
          </svg>
          {sollBezeichnung}
        </span>
      </div>
    </>
  );
}
