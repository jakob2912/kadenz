"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { wochenschalterUmlegen } from "@/lib/wochenplan-actions";
import type { Wochenstand } from "@/lib/wochenplan";
import { wochenText } from "@/lib/plan";
import { kurzDatum } from "@/components/ui";

/**
 * Die zwei Schalter der Woche: erster Push am Mo oder Di, Wochenende als
 * Fr + Sa oder Sa + So. Ohne Wahl gilt der Zwei-Wochen-Rhythmus. Was sich nicht mehr
 * umlegen lässt, ist ausgegraut, mit dem Grund darunter — die Prüfung selbst
 * macht der Server (wochenwahlSetzen()).
 */
export function WochenplanSchalter({ stand }: { stand: Wochenstand }) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  function umlegen(schalter: "frueh" | "spaet", wert: string) {
    if (laeuft) return;
    setFehler(null);
    starte(async () => {
      const r = await wochenschalterUmlegen(schalter, wert);
      if (!r.ok) setFehler(r.fehler);
      else router.refresh();
    });
  }

  return (
    <div className="mt-6">
      <p className="text-center text-[11px] uppercase tracking-[0.11em] text-fg-faint">
        Woche {stand.rhythmus} · ab {kurzDatum(stand.montag)}
      </p>
      <p className="mt-1 text-center text-[13px] text-fg-dim">{wochenText(stand)}</p>

      <Schalter
        titel="Erster Push"
        optionen={[
          ["mo", "Montag"],
          ["di", "Dienstag"],
        ]}
        wert={stand.frueh}
        gesperrt={stand.fruehGesperrt}
        laeuft={laeuft}
        onWahl={(w) => umlegen("frueh", w)}
      />
      <Schalter
        titel="Wochenende"
        optionen={[
          ["frsa", "Fr + Sa"],
          ["saso", "Sa + So"],
        ]}
        wert={stand.spaet}
        gesperrt={stand.spaetGesperrt}
        laeuft={laeuft}
        onWahl={(w) => umlegen("spaet", w)}
      />

      {fehler && (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-strain" aria-live="polite">
          {fehler}
        </p>
      )}
    </div>
  );
}

function Schalter({
  titel,
  optionen,
  wert,
  gesperrt,
  laeuft,
  onWahl,
}: {
  titel: string;
  optionen: [string, string][];
  wert: string;
  gesperrt: string | null;
  laeuft: boolean;
  onWahl: (wert: string) => void;
}) {
  return (
    <div className="mt-3">
      <div
        role="radiogroup"
        aria-label={titel}
        className="grid grid-cols-[88px_1fr_1fr] items-center gap-1 rounded-md bg-surface-2 p-1"
      >
        <span className="pl-2 text-[11px] text-fg-faint">{titel}</span>
        {optionen.map(([schluessel, name]) => {
          const aktiv = schluessel === wert;
          const aus = laeuft || (gesperrt !== null && !aktiv);
          return (
            <button
              key={schluessel}
              type="button"
              role="radio"
              aria-checked={aktiv}
              disabled={aus}
              onClick={() => !aktiv && onWahl(schluessel)}
              className={`min-h-[44px] rounded-sm px-2 text-[13px] font-semibold transition
                ${aktiv ? "bg-surface-3 text-fg" : "text-fg-dim md:hover:text-fg"}
                ${aus && !aktiv ? "opacity-40" : ""}`}
            >
              {name}
            </button>
          );
        })}
      </div>
      {gesperrt && (
        <p className="mt-1 text-center text-[11px] leading-relaxed text-fg-faint">{gesperrt}</p>
      )}
    </div>
  );
}
