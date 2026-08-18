"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { vorschlagAblehnen, vorschlagAnnehmen } from "@/lib/ernaehrung-actions";
import { Card, Eyebrow, de } from "@/components/ui";
import type { Vorschlag } from "@/lib/ernaehrung";

/**
 * Der Kalorienvorschlag des Coaches — mit Ja und Nein.
 *
 * Der Coach rechnet, Jakob entscheidet. Deshalb steht hier eine Frage und
 * keine Meldung: eine Karte, die "Ziel auf 3770 erhöht" verkündet, hätte die
 * Entscheidung schon getroffen.
 *
 * Beide Tasten sind gleich groß und gleich erreichbar. Ein kleines,
 * blassgraues Nein neben einem großen blauen Ja wäre eine Frage, die eine
 * Antwort erwartet — dann kann man sie auch weglassen.
 *
 * Alles in Eisblau: ein Kalorienvorschlag ist kein Regenerationszustand.
 * Grün/Amber/Koralle sind in dieser App für Erholung reserviert, und ein
 * amberfarbener Vorschlag läse sich wie eine Warnung des Körpers.
 */

type Status =
  | { art: "ruhe" }
  | { art: "angenommen"; kcal: number }
  | { art: "abgelehnt" }
  | { art: "fehler"; text: string };

export function KalorienVorschlag({ vorschlag }: { vorschlag: Vorschlag }) {
  const [status, setStatus] = useState<Status>({ art: "ruhe" });
  const [laeuft, starte] = useTransition();
  const reduce = useReducedMotion();

  const hoch = vorschlag.kcalNeu > vorschlag.kcalAlt;
  const delta = vorschlag.kcalNeu - vorschlag.kcalAlt;
  const entschieden = status.art === "angenommen" || status.art === "abgelehnt";

  function entscheiden(ja: boolean) {
    // In einer Transition, weil die Action revalidiert: die neu gerenderte
    // Seite kommt in derselben Antwort zurück und löst diese Karte ab.
    // Die beiden Zweige bewusst getrennt statt ueber einen Ternaer: nur
    // vorschlagAnnehmen liefert kcal zurueck. Vereinigt man die Rueckgabetypen,
    // ist das Feld anschliessend nicht mehr garantiert.
    starte(async () => {
      if (ja) {
        const r = await vorschlagAnnehmen(vorschlag.id);
        if (!r.ok) {
          setStatus({ art: "fehler", text: r.fehler });
          return;
        }
        setStatus({ art: "angenommen", kcal: r.kcal });
        return;
      }

      const r = await vorschlagAblehnen(vorschlag.id);
      if (!r.ok) {
        setStatus({ art: "fehler", text: r.fehler });
        return;
      }
      setStatus({ art: "abgelehnt" });
    });
  }

  return (
    <Card className="border-accent/30">
      <Eyebrow>Vorschlag · Kadenz</Eyebrow>

      <h2 className="mt-2 text-[19px] font-bold leading-snug tracking-[-0.02em]">
        Sollen wir die Kalorien auf {vorschlag.kcalNeu} {hoch ? "erhöhen" : "senken"}?
      </h2>

      <div className="mt-3.5 flex flex-col gap-2 rounded-md border border-hair bg-surface-3 p-3.5">
        <Zeile
          label="Kalorien"
          von={`${vorschlag.kcalAlt} kcal`}
          nach={`${vorschlag.kcalNeu} kcal`}
          delta={`${delta > 0 ? "+" : "−"}${Math.abs(delta)}`}
        />
        <Zeile
          label="Kohlenhydrate"
          von={`${vorschlag.kohlenhydrateAltG} g`}
          nach={`${vorschlag.kohlenhydrateNeuG} g`}
          delta={`${vorschlag.kohlenhydrateNeuG > vorschlag.kohlenhydrateAltG ? "+" : "−"}${Math.abs(
            vorschlag.kohlenhydrateNeuG - vorschlag.kohlenhydrateAltG
          )}`}
        />
        {/* Eiweiß und Fett stehen bewusst mit da, obwohl sie sich nicht ändern.
            Ohne sie bliebe offen, ob der Vorschlag sie stillschweigend mit
            verschiebt. */}
        <p className="text-[11px] leading-relaxed text-fg-faint">
          Eiweiß {vorschlag.eiweissG} g und Fett {vorschlag.fettG} g bleiben unverändert.
        </p>
      </div>

      {/* whitespace-pre-line: die Begründung kann einen zweiten Absatz zur
          Eiweißmenge enthalten, der nicht in denselben Block gehört. */}
      <p className="mt-3.5 whitespace-pre-line text-sm leading-relaxed text-fg-dim">
        {vorschlag.begruendung}
      </p>

      <p className="mt-2.5 text-[11px] leading-relaxed text-fg-faint">
        Gemessen {de(vorschlag.gemesseneRate, 2)} kg pro Woche · angepeilt{" "}
        {de(vorschlag.zielRate, 2)} kg pro Woche
      </p>

      {!entschieden && (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => entscheiden(false)}
            disabled={laeuft}
            className="min-h-[52px] rounded-md border border-hair bg-surface-3 font-semibold
                       text-fg-dim transition active:scale-[0.98] disabled:opacity-55
                       md:hover:border-accent/35 md:hover:text-fg"
          >
            Nein
          </button>
          <button
            type="button"
            onClick={() => entscheiden(true)}
            disabled={laeuft}
            aria-busy={laeuft}
            className="min-h-[52px] rounded-md bg-accent font-semibold text-on-accent
                       transition active:scale-[0.98] disabled:opacity-55"
          >
            {laeuft ? "Moment…" : "Ja"}
          </button>
        </div>
      )}

      {/* Dauerhaft im Baum, nicht erst mit der Meldung eingehängt: sonst lesen
          Screenreader sie oft gar nicht vor. */}
      <div role="status" aria-live="polite">
        <AnimatePresence mode="wait">
          {status.art !== "ruhe" && (
            <motion.p
              key={status.art}
              initial={reduce ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={`mt-3 rounded-sm border px-3.5 py-2.5 text-xs leading-relaxed ${
                status.art === "fehler"
                  ? "border-strain/30 bg-strain/10 text-strain"
                  : "border-accent/30 bg-accent/10 text-accent"
              }`}
            >
              {status.art === "angenommen" &&
                `Neues Ziel: ${status.kcal} kcal. Ab jetzt messe ich mindestens zehn Tage, bevor ich wieder etwas vorschlage.`}
              {status.art === "abgelehnt" &&
                "Bleibt, wie es ist. Ich frage frühestens in zehn Tagen wieder."}
              {status.art === "fehler" &&
                `Nicht gespeichert: ${status.text} Nochmal versuchen — entschieden ist noch nichts.`}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

function Zeile({
  label,
  von,
  nach,
  delta,
}: {
  label: string;
  von: string;
  nach: string;
  delta: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-fg-dim">{label}</span>
      <span className="whitespace-nowrap text-sm">
        <s className="text-fg-faint decoration-fg-faint/60">{von}</s>{" "}
        <b className="font-semibold text-fg">{nach}</b>
        <em className="ml-1.5 text-[11px] not-italic text-accent">{delta}</em>
      </span>
    </div>
  );
}
