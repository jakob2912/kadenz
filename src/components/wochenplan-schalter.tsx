"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { wochenplanWechseln } from "@/lib/wochenplan-actions";
import { WOCHENPLAN_NAMEN, type Wochenplan } from "@/lib/plan";
import { kurzDatum } from "@/components/ui";

/**
 * Umschalten zwischen den beiden Wochenplänen.
 *
 * Gedacht für den Tag, an dem ein Push-Tag ausfällt: Mo oder Fr geht nicht,
 * also Wochenende — Di bzw. Sa wird Push. Ab wann der Wechsel gilt, rechnet
 * wochenplanSetzen() aus dem, was schon geloggt ist; hier steht nur die
 * Antwort.
 */
export function WochenplanSchalter({ aktuell }: { aktuell: Wochenplan }) {
  const router = useRouter();
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  function wechseln(plan: Wochenplan) {
    if (plan === aktuell || laeuft) return;
    setMeldung(null);
    starte(async () => {
      const r = await wochenplanWechseln(plan);
      if (!r.ok) {
        setMeldung(r.fehler);
        return;
      }
      setMeldung(r.ab ? `Gilt ab ${kurzDatum(r.ab)}.` : null);
      router.refresh();
    });
  }

  return (
    <div className="mt-6">
      <p className="text-center text-[11px] uppercase tracking-[0.11em] text-fg-faint">
        Wochenplan
      </p>
      <div
        role="radiogroup"
        aria-label="Wochenplan"
        className="mt-2 grid grid-cols-2 gap-1 rounded-md bg-surface-2 p-1"
      >
        {(Object.keys(WOCHENPLAN_NAMEN) as Wochenplan[]).map((plan) => {
          const [titel, tage] = WOCHENPLAN_NAMEN[plan].split(" · ");
          const aktiv = plan === aktuell;
          return (
            <button
              key={plan}
              type="button"
              role="radio"
              aria-checked={aktiv}
              disabled={laeuft}
              onClick={() => wechseln(plan)}
              className={`flex min-h-[48px] flex-col items-center justify-center rounded-sm px-2 text-center transition
                ${aktiv ? "bg-surface-3 text-fg" : "text-fg-dim md:hover:text-fg"}
                ${laeuft ? "opacity-60" : ""}`}
            >
              <span className="text-[13px] font-semibold">{titel}</span>
              <span className="text-[11px] text-fg-faint">{tage}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[11px] leading-relaxed text-fg-faint" aria-live="polite">
        {meldung ??
          "Fällt Mo oder Fr aus, auf Wochenende schalten — dann ist Di bzw. Sa Push."}
      </p>
    </div>
  );
}
