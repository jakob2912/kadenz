import Link from "next/link";
import { connection } from "next/server";
import { Card, Eyebrow, de } from "@/components/ui";
import { saetzeProUebung, trendGrundlage, FENSTER_TAGE } from "@/lib/kraftverlauf";
import { trendSaetzeProUebung } from "@/lib/bankcoach";
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
  /* saetzeProUebung() rechnet das Zeitfenster ab heute — beim Bauen steht der
     Tag noch nicht fest, und ein eingefrorenes Fenster zeigte in einer Woche
     die falschen Übungen. */
  await connection();

  let proUebung: Record<string, Awaited<ReturnType<typeof saetzeProUebung>>[string]>;

  try {
    proUebung = await saetzeProUebung();
  } catch (e) {
    console.error("Kraftverlauf nicht lesbar:", e);
    return (
      <Card className="mt-3.5">
        <Eyebrow>Strength trend</Eyebrow>
        <p className="mt-2 text-sm leading-relaxed text-fg-dim">
          The training history can’t be read right now. The body weight above comes from
          Google Health and isn’t affected.
        </p>
      </Card>
    );
  }

  /* Neustarts und Bank-Historie sind Beiwerk: fehlen sie, steht die Liste
     wie bisher — nur ohne die Korrekturen. */
  let grundlage: Awaited<ReturnType<typeof trendGrundlage>> = { neustarts: {}, bankTmHistorie: [] };
  try {
    grundlage = await trendGrundlage();
  } catch (e) {
    console.error("Neustarts nicht lesbar:", e);
  }

  const raenge = rangliste(
    trendSaetzeProUebung(proUebung, grundlage.bankTmHistorie),
    grundlage.neustarts
  );

  if (raenge.length === 0) {
    return (
      <Card className="mt-3.5">
        <Eyebrow>Strength trend</Eyebrow>
        <p className="mt-2 text-sm leading-relaxed text-fg-dim">
          No logged sets in the last {FENSTER_TAGE} days. Once you check off sets in a
          workout, this shows your estimated max per exercise and whether it is rising.
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
        <Eyebrow>Strength trend</Eyebrow>
        <span className="text-[11px] text-fg-faint">
          {raenge.length} exercises · last {FENSTER_TAGE} days
        </span>
      </div>

      <p className="mt-1.5 text-[13px] leading-relaxed text-fg-dim">
        Compared by the percentage change of your estimated max, not by kilograms —
        2.5 kg is an eighth more on the preacher curl and a fiftieth on the leg curl.
        Whatever is stuck comes first.
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
            <span className="shrink-0 text-[11px] text-fg-faint">no verdict yet</span>
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
              Best ({FENSTER_TAGE} days) {de(best.kg, 1)} kg × {best.reps}
              {bestesMaximum !== null && <> · est. max {de(bestesMaximum, 1)} kg</>}
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
