"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { de, kurzDatum, langDatum } from "@/components/ui";

export type Reihenpunkt = { datum: string; wert: number };

/** Lineare Zwischenstelle einer Reihe an einem Tag — für den Plan an einem Messtag. */
function wertAm(reihe: Reihenpunkt[], ms: number): number | null {
  for (let i = 1; i < reihe.length; i++) {
    const a = Date.parse(reihe[i - 1].datum);
    const b = Date.parse(reihe[i].datum);
    if (ms >= a && ms <= b) {
      const anteil = b === a ? 0 : (ms - a) / (b - a);
      return reihe[i - 1].wert + anteil * (reihe[i].wert - reihe[i - 1].wert);
    }
  }
  return null;
}

/**
 * Schlichter Linienchart. Messlücken werden nicht überbrückt, sondern gezeigt.
 *
 * Stand als GewichtsChart in der Verlaufsseite und war fest auf Kilogramm
 * verdrahtet. Der Kraftverlauf braucht dieselbe Kurve für das geschätzte
 * Maximum je Übung — und ein zweites Inline-SVG daneben hätte bedeutet, jede
 * Korrektur an der Achsenbeschriftung oder der Lückenlogik zweimal zu machen.
 *
 * Antippbar: ein Tipp (oder Ziehen) setzt eine senkrechte Linie auf den
 * nächsten Messtag und zeigt Wert und Datum darüber — vorher war von einer
 * Kurve nur der Verlauf abzulesen, nie eine Zahl. Ohne Auswahl steht dort der
 * letzte Wert. Mit `zeitraeume` kommen Knöpfe für 30/90/365 Tage dazu.
 */
export function ReihenChart({
  reihe: ganzeReihe,
  soll,
  zeitraeume,
  sollBezeichnung = "Plan",
  einheit = "kg",
  stellen = 1,
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
  /** Nachkommastellen in der Ablesung über dem Diagramm. */
  stellen?: number;
  /** Ab wie vielen Tagen ohne Wert die Linie getrennt wird. */
  lueckeTage?: number;
  /** Was dasteht, solange gar nichts vorliegt. */
  leer: string;
  /** Was dasteht, wenn nur ein einziger Punkt vorliegt. */
  einzeln: string;
  /** Für die Bildbeschreibung: "Gewichtsverlauf", "Kraftverlauf Bankdrücken". */
  bezeichnung?: string;
  /**
   * Wählbare Zeiträume in Tagen, der erste ist voreingestellt. Gezählt ab
   * dem letzten Messpunkt, nicht ab heute: nach einer Woche ohne Messung
   * soll "30 Tage" nicht nur noch drei Wochen zeigen.
   */
  zeitraeume?: number[];
}) {
  const [zeitraum, setZeitraum] = useState(zeitraeume?.[0] ?? null);
  const [auswahl, setAuswahl] = useState<number | null>(null);

  const ende = ganzeReihe.length > 0 ? Date.parse(ganzeReihe[ganzeReihe.length - 1].datum) : 0;
  const beginn = zeitraum === null ? -Infinity : ende - zeitraum * 864e5;
  const reihe = ganzeReihe.filter((p) => Date.parse(p.datum) > beginn);

  /* Die Knöpfe nur für Zeiträume, die mehr zeigen als der kleinere davor —
     liegen erst sechs Wochen Daten vor, sind 90 und 365 dasselbe Bild. */
  const anfangGesamt = ganzeReihe.length > 0 ? Date.parse(ganzeReihe[0].datum) : 0;
  const waehlbar = (zeitraeume ?? []).filter(
    (z, i, alle) => i === 0 || ende - alle[i - 1] * 864e5 > anfangGesamt
  );
  const knoepfe =
    waehlbar.length > 1 ? (
      <div className="mt-3 flex gap-1.5" role="group" aria-label="Zeitraum">
        {waehlbar.map((z) => (
          <button
            key={z}
            type="button"
            aria-pressed={z === zeitraum}
            onClick={() => {
              setZeitraum(z);
              setAuswahl(null);
            }}
            className={`min-h-[36px] rounded-md px-3 text-[12px] font-semibold tabular-nums transition ${
              z === zeitraum
                ? "bg-surface-3 text-fg"
                : "text-fg-dim active:bg-surface-2 active:text-fg"
            }`}
          >
            {z >= 3650 ? "Alles" : z === 365 ? "1 Jahr" : `${z} Tage`}
          </button>
        ))}
      </div>
    ) : null;

  if (reihe.length < 2) {
    return (
      <>
        {knoepfe}
        <p className="mt-4 text-sm leading-relaxed text-fg-dim">{reihe.length === 0 ? leer : einzeln}</p>
      </>
    );
  }

  const VW = 340;
  const VH = 170;
  const P = 32;

  /* Der Plan beginnt mit dem gewählten Zeitraum, endet aber, wo er endet —
     über die letzte Messung hinaus zu zeigen, wohin es geht, ist sein Zweck. */
  const sollReihe = (soll ?? []).filter((p) => Date.parse(p.datum) > beginn);

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

  /* Der Tipp sucht den nächsten Messtag nach der Waagrechten — man zielt auf
     ein Datum, nicht auf eine 2,5 px dünne Linie. */
  function waehlen(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * VW;
    let beste = 0;
    reihe.forEach((p, i) => {
      if (Math.abs(x(p.datum) - vx) < Math.abs(x(reihe[beste].datum) - vx)) beste = i;
    });
    setAuswahl(beste);
  }
  function taste(e: KeyboardEvent<SVGSVGElement>) {
    const jetzt = auswahl ?? reihe.length - 1;
    if (e.key === "ArrowLeft") setAuswahl(Math.max(0, jetzt - 1));
    else if (e.key === "ArrowRight") setAuswahl(Math.min(reihe.length - 1, jetzt + 1));
    else if (e.key === "Escape") setAuswahl(null);
    else return;
    e.preventDefault();
  }

  const gezeigt = reihe[auswahl !== null && auswahl < reihe.length ? auswahl : reihe.length - 1];
  const planAmTag = sollReihe.length > 1 ? wertAm(sollReihe, Date.parse(gezeigt.datum)) : null;
  const ablesung = (
    /* Immer da, auch ohne Auswahl (dann der letzte Wert): so springt beim
       ersten Tipp nichts, und die jüngste Zahl steht ohne Suchen da. */
    <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-[12px] text-fg-faint" aria-live="polite">
      <b className="text-[15px] font-semibold tabular-nums text-fg">
        {de(gezeigt.wert, stellen)} {einheit}
      </b>
      <span>{kurzDatum(gezeigt.datum)}</span>
      {planAmTag !== null && (
        <span className="tabular-nums">
          · {sollBezeichnung} {de(planAmTag, stellen)} {einheit}
        </span>
      )}
    </p>
  );

  const diagramm = (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="mt-2 block h-[170px] w-full touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-sm"
      role="img"
      tabIndex={0}
      onPointerDown={waehlen}
      onPointerMove={(e) => {
        // Maus: folgen. Finger: nur solange er aufliegt.
        if (e.pointerType === "mouse" || e.buttons > 0) waehlen(e);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setAuswahl(null);
      }}
      onKeyDown={taste}
      aria-label={
        `${bezeichnung} von ${de(erste.wert, 1)} ${einheit} am ${kurzDatum(erste.datum)} ` +
        `auf ${de(letzte.wert, 1)} ${einheit} am ${kurzDatum(letzte.datum).replace(/\.$/, "")}` +
        (sollReihe.length > 1
          ? `. Gestrichelt daneben ${sollBezeichnung}: ${de(sollReihe[0].wert, 1)} ${einheit} ` +
            `am ${kurzDatum(sollReihe[0].datum)} auf ` +
            `${de(sollReihe[sollReihe.length - 1].wert, 1)} ${einheit} am ` +
            `${kurzDatum(sollReihe[sollReihe.length - 1].datum).replace(/\.$/, "")}.`
          : "") +
        ". Pfeiltasten wählen einen Messtag."
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

      {auswahl !== null && (
        <line
          x1={x(gezeigt.datum)}
          y1={12}
          x2={x(gezeigt.datum)}
          y2={VH - 24}
          stroke="var(--color-fg-faint)"
          strokeWidth="1"
        />
      )}

      <circle
        cx={x(gezeigt.datum)}
        cy={y(gezeigt.wert)}
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
        {achsenDatum(t0, t1 - t0)}
      </text>
      <text x={VW - 14} y={VH - 4} textAnchor="end" className="fill-fg-faint text-[10px] font-semibold">
        {achsenDatum(t1, t1 - t0)}
      </text>
    </svg>
  );

  /* Ohne Legende ist eine gestrichelte Linie nur eine zweite Linie. Sie steht
     als Text daneben und nicht im SVG: so wird sie mitgelesen, mitgesucht und
     skaliert mit der Schriftgröße des Systems. */
  if (sollReihe.length < 2) {
    return (
      <>
        {knoepfe}
        {ablesung}
        {diagramm}
      </>
    );
  }

  return (
    <>
      {knoepfe}
      {ablesung}
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

/**
 * Achsenbeschriftung, die sich nach der Spanne richtet.
 *
 * Unter einem halben Jahr sagt der Wochentag mehr als die Jahreszahl — das
 * ist der Fall bei Gewicht und Kraftverlauf, und dafür war die Achse gebaut.
 * Die Trainingsmax-Projektion auf dem Bank-Tab läuft dagegen über fünfzehn
 * Monate; dort stand links "Sa., 22. Aug." und rechts "Di., 17. Aug.", und
 * beides sah nach demselben Monat aus.
 *
 * Als Regel im Diagramm und nicht als Aufrufer-Vorgabe: welche Spanne das
 * Bild zeigt, weiß es selbst am besten, und ein zusätzliches Format-Argument
 * wäre eine Entscheidung, die jeder Aufrufer neu treffen müsste.
 */
const HALBES_JAHR_MS = 182 * 864e5;

function achsenDatum(ms: number, spanneMs: number): string {
  const iso = new Date(ms).toISOString().slice(0, 10);
  return spanneMs > HALBES_JAHR_MS ? langDatum(iso) : kurzDatum(iso);
}
