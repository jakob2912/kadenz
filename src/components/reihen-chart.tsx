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
  einheit = "kg",
  lueckeTage = 3,
  leer,
  einzeln,
  bezeichnung = "Verlauf",
}: {
  reihe: Reihenpunkt[];
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
  const werte = reihe.map((r) => r.wert);

  /* Der Rand war fest ±1 kg — beim Körpergewicht passt das, beim geschätzten
     Maximum einer Übung mit 30 kg Spanne wäre die Kurve gegen die Ränder
     geklebt. Anteilig, aber nie unter einer Einheit, damit eine flache Reihe
     nicht auf eine Linie zusammenfällt. */
  const spanne = Math.max(...werte) - Math.min(...werte);
  const rand = Math.max(1, spanne * 0.15);
  const lo = Math.floor(Math.min(...werte) - rand);
  const hi = Math.ceil(Math.max(...werte) + rand);

  const t0 = Date.parse(reihe[0].datum);
  const t1 = Date.parse(reihe[reihe.length - 1].datum);
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

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="mt-4 block h-[170px] w-full"
      role="img"
      aria-label={`${bezeichnung} von ${de(erste.wert, 1)} ${einheit} am ${kurzDatum(
        erste.datum
      )} auf ${de(letzte.wert, 1)} ${einheit} am ${kurzDatum(letzte.datum)}`}
    >
      {[lo, (lo + hi) / 2, hi].map((g) => (
        <g key={g}>
          <line x1={P} y1={y(g)} x2={VW - 14} y2={y(g)} stroke="var(--color-hair-soft)" />
          <text x="0" y={y(g) + 3.5} className="fill-fg-faint text-[10px] font-semibold">
            {de(g, 0)}
          </text>
        </g>
      ))}

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
          gleichmäßiger Abstand. */}
      <text x={P} y={VH - 4} className="fill-fg-faint text-[10px] font-semibold">
        {kurzDatum(erste.datum)}
      </text>
      <text x={VW - 14} y={VH - 4} textAnchor="end" className="fill-fg-faint text-[10px] font-semibold">
        {kurzDatum(letzte.datum)}
      </text>
    </svg>
  );
}
