import Link from "next/link";
import { Card, Eyebrow, de } from "@/components/ui";
import { saetzeProUebung, FENSTER_TAGE } from "@/lib/kraftverlauf";
import { besterSatz, e1rm, rangliste, type Rang } from "@/lib/kraft";

/**
 * Der Kraftverlauf über alle Übungen.
 *
 * Bewusst aufsteigend sortiert: oben steht, was hängt. Wer die Liste öffnet,
 * will wissen, wo er nachsehen muss — was ohnehin läuft, braucht keine
 * Aufmerksamkeit.
 *
 * Zur Farbe: der Balken ist durchgehend Eisblau, auch wenn es abwärts geht.
 * Grün, Amber und Koralle stehen in dieser App für Regenerationszustände, und
 * eine zweite Bedeutung für dieselben drei Farben zwänge dazu, bei jeder
 * Karte neu zu überlegen, welche Skala gerade gilt. Die Richtung steht in der
 * Balkenrichtung, im Vorzeichen und im Wort.
 */
export async function Kraftverlauf() {
  let proUebung: Record<string, Awaited<ReturnType<typeof saetzeProUebung>>[string]>;

  try {
    proUebung = await saetzeProUebung();
  } catch (e) {
    console.error("Kraftverlauf nicht lesbar:", e);
    return (
      <Card className="mt-3.5">
        <Eyebrow>Kraftverlauf</Eyebrow>
        <p className="mt-2 text-sm leading-relaxed text-fg-dim">
          Die Trainingshistorie ist gerade nicht lesbar. Das Gewicht oben stammt aus Google
          Health und ist davon nicht betroffen.
        </p>
      </Card>
    );
  }

  const raenge = rangliste(proUebung);

  if (raenge.length === 0) {
    return (
      <Card className="mt-3.5">
        <Eyebrow>Kraftverlauf</Eyebrow>
        <p className="mt-2 text-sm leading-relaxed text-fg-dim">
          Noch keine geloggten Sätze in den letzten {FENSTER_TAGE} Tagen. Sobald du im
          Training Sätze abhakst, steht hier je Übung dein geschätztes Maximum und ob es
          steigt.
        </p>
      </Card>
    );
  }

  // Maßstab für die Balken: die stärkste Bewegung in der Liste bekommt die
  // volle Länge. Eine feste Skala wäre entweder bei kleinen Änderungen leer
  // oder bei großen abgeschnitten.
  const groesste = Math.max(
    ...raenge.map((r) => (r.urteil.verwertbar ? Math.abs(r.urteil.prozentPro4Wochen) : 0)),
    1
  );

  return (
    <Card className="mt-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Kraftverlauf</Eyebrow>
        <span className="text-[11px] text-fg-faint">
          {raenge.length} Übungen · letzte {FENSTER_TAGE} Tage
        </span>
      </div>

      <p className="mt-1.5 text-[13px] leading-relaxed text-fg-dim">
        Verglichen wird die Änderung deines geschätzten Maximums in Prozent, nicht in
        Kilogramm — 2,5 kg sind auf dem Preacher Curl ein Achtel mehr und auf dem Leg Curl
        ein Fünfzigstel. Was hängt, steht oben.
      </p>

      <ul className="mt-4 flex flex-col gap-3.5">
        {raenge.map((rang) => (
          <Zeile key={rang.uebung} rang={rang} groesste={groesste} saetze={proUebung[rang.uebung]} />
        ))}
      </ul>
    </Card>
  );
}

function Zeile({
  rang,
  groesste,
  saetze,
}: {
  rang: Rang;
  groesste: number;
  saetze: Awaited<ReturnType<typeof saetzeProUebung>>[string];
}) {
  const best = besterSatz(saetze);
  const bestesMaximum = best ? e1rm(best) : null;

  return (
    <li>
      <Link
        href={`/verlauf/${encodeURIComponent(rang.uebung)}`}
        className="block rounded-sm transition md:hover:bg-surface-2"
      >
        <div className="flex items-baseline justify-between gap-3">
          <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">{rang.uebung}</b>
          {rang.urteil.verwertbar ? (
            <span className="num shrink-0 text-[13px] font-semibold text-fg-dim">
              {rang.urteil.prozentPro4Wochen > 0 ? "+" : "−"}
              {de(Math.abs(rang.urteil.prozentPro4Wochen), 1)} %
            </span>
          ) : (
            <span className="shrink-0 text-[11px] text-fg-faint">noch kein Urteil</span>
          )}
        </div>

        {rang.urteil.verwertbar && (
          <div className="relative mt-1.5 h-1.5 rounded-full bg-surface-3">
            <span className="absolute inset-y-[-3px] left-1/2 w-px bg-hair" aria-hidden />
            <span
              className="absolute inset-y-0 rounded-full bg-accent"
              style={balken(rang.urteil.prozentPro4Wochen, groesste)}
              aria-hidden
            />
          </div>
        )}

        <p className="mt-1.5 text-[11px] leading-relaxed text-fg-faint">
          {best && (
            <>
              Bestleistung {de(best.kg, 1)} kg × {best.reps}
              {bestesMaximum !== null && <> · geschätztes Maximum {de(bestesMaximum, 1)} kg</>}
              {" · "}
            </>
          )}
          {rang.urteil.verwertbar ? rang.urteil.text : rang.urteil.grund}
        </p>
      </Link>
    </li>
  );
}

/**
 * Balken ab der Mitte: nach rechts, wenn es aufwärts geht, nach links, wenn
 * nicht. Länge im Verhältnis zur stärksten Bewegung der Liste.
 */
function balken(prozent: number, groesste: number): { left: string; width: string } {
  const anteil = Math.min(50, (Math.abs(prozent) / groesste) * 50);
  return prozent >= 0
    ? { left: "50%", width: `${anteil}%` }
    : { left: `${50 - anteil}%`, width: `${anteil}%` };
}
