import { connection } from "next/server";
import { Card, Eyebrow, heuteWien } from "@/components/ui";
import { saetzeDerLetztenWochen } from "@/lib/einheiten-daten";
import { MUSKELGRUPPEN, MUSKEL_NAMEN, wochenvolumen } from "@/lib/muskeln";

const WOCHEN = 5;

/**
 * Sätze je Muskelgruppe über die letzten fünf Wochen.
 *
 * Je Zeile fünf Balken, älteste Woche links, die laufende rechts und
 * hervorgehoben. Bewusst ohne Zielbereich und ohne Ampel: wie viele Sätze
 * eine Muskelgruppe braucht, entscheidet Jakobs Plan, nicht eine Faustregel
 * aus dem Netz. Die Karte zeigt, wo es abweicht — eine Gruppe, die neben den
 * anderen kaum Balken hat, sieht man ohne Zahl. Farbe durchgehend Eisblau,
 * wie im Kraftverlauf: Grün, Amber und Koralle sind Regeneration.
 */
export async function Wochenueberblick() {
  await connection();

  let saetze: Awaited<ReturnType<typeof saetzeDerLetztenWochen>>;
  try {
    saetze = await saetzeDerLetztenWochen(WOCHEN);
  } catch (e) {
    console.error("Wochenüberblick nicht lesbar:", e);
    return null;
  }

  const wochen = wochenvolumen(saetze, heuteWien(), WOCHEN);
  /* Alle Gruppen, die der Split trainiert, auch mit null Sätzen — eine leere
     Zeile ist genau das Signal "kommt zu kurz". Adduktoren nur, wenn sie
     überhaupt vorkommen: die stehen nur zeitweise im Plan. */
  const gruppen = MUSKELGRUPPEN.filter(
    (g) => g !== "Adduktoren" || wochen.some((w) => (w.jeGruppe[g] ?? 0) > 0)
  );
  const ohneZuordnung = wochen.reduce((n, w) => n + w.ohneZuordnung, 0);
  const hoechster = Math.max(1, ...wochen.flatMap((w) => gruppen.map((g) => w.jeGruppe[g] ?? 0)));
  const diese = wochen[WOCHEN - 1];
  const vorige = wochen[WOCHEN - 2];

  return (
    <Card className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Sets per muscle group</Eyebrow>
        <span className="text-[11px] text-fg-faint">{WOCHEN} weeks</span>
      </div>

      <div className="mt-3.5 flex gap-6">
        <div>
          <Eyebrow>This week</Eyebrow>
          <p className="num mt-1 text-[22px]">
            {diese.saetze}
            <span className="text-xs font-medium text-fg-faint"> sets so far</span>
          </p>
        </div>
        <div>
          <Eyebrow>Last week</Eyebrow>
          <p className="num mt-1 text-[22px]">
            {vorige.saetze}
            <span className="text-xs font-medium text-fg-faint"> sets</span>
          </p>
        </div>
      </div>

      {wochen.every((w) => w.saetze === 0) ? (
        <p className="mt-3 text-sm leading-relaxed text-fg-dim">
          No sets in the last {WOCHEN} weeks.
        </p>
      ) : (
        <table className="mt-4 w-full border-separate border-spacing-y-1.5" aria-label="Sets per muscle group and week">
          <thead>
            <tr>
              <th scope="col" className="w-[30%] text-left text-[10px] font-semibold uppercase tracking-[0.11em] text-fg-faint">
                Group
              </th>
              <th scope="col" className="text-left text-[10px] font-semibold uppercase tracking-[0.11em] text-fg-faint">
                <span aria-hidden>{WOCHEN - 1} wk ago → now</span>
                <span className="sr-only">Trend over {WOCHEN} weeks</span>
              </th>
              <th scope="col" className="w-[44px] text-right text-[10px] font-semibold uppercase tracking-[0.11em] text-fg-faint">
                <abbr title="Last week" className="no-underline">
                  Last
                </abbr>
              </th>
              <th scope="col" className="w-[44px] text-right text-[10px] font-semibold uppercase tracking-[0.11em] text-fg-faint">
                Now
              </th>
            </tr>
          </thead>
          <tbody>
            {gruppen.map((g) => (
              <tr key={g}>
                <th scope="row" className="text-left text-[13px] font-medium text-fg-dim">
                  {MUSKEL_NAMEN[g]}
                </th>
                <td>
                  <span className="flex h-[22px] items-end gap-1" aria-hidden>
                    {wochen.map((w, i) => {
                      const wert = w.jeGruppe[g] ?? 0;
                      return (
                        <span
                          key={w.montag}
                          className={`block flex-1 rounded-[3px] ${
                            i === WOCHEN - 1 ? "bg-accent" : "bg-accent/35"
                          }`}
                          style={{ height: `${Math.max(wert > 0 ? 12 : 4, (wert / hoechster) * 100)}%`, opacity: wert > 0 ? 1 : 0.25 }}
                        />
                      );
                    })}
                  </span>
                  <span className="sr-only">
                    oldest week first: {wochen.map((w) => zahl(w.jeGruppe[g] ?? 0)).join(", ")}
                  </span>
                </td>
                <td className="text-right text-[13px] tabular-nums text-fg-dim">
                  {zahl(vorige.jeGruppe[g] ?? 0)}
                </td>
                <td className="text-right text-[13px] font-semibold tabular-nums text-fg">
                  {zahl(diese.jeGruppe[g] ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
        Secondary muscles count half — one set of bench press is one set of chest and half a
        set each of triceps and shoulders. “Now” is the current week, which isn’t over yet;
        last week stands next to it for comparison.
        {ohneZuordnung > 0 && (
          <>
            {" "}
            {ohneZuordnung === 1 ? "One set" : `${ohneZuordnung} sets`} couldn’t be assigned to a
            group and are missing above.
          </>
        )}
      </p>
    </Card>
  );
}

/** 3 → "3", 2,5 → "2,5" */
function zahl(n: number): string {
  return String(Math.round(n * 2) / 2);
}
