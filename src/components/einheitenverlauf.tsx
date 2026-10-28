import { connection } from "next/server";
import { Card, Eyebrow, anzahl, heuteWien, kurzDatum } from "@/components/ui";
import { letzteEinheiten, trainingstage, type Einheitsbericht } from "@/lib/einheiten-daten";
import { EINHEITEN_PRO_WOCHE, kalender, montagVon, serie } from "@/lib/einheiten";

const WOCHEN = 12;
const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/**
 * Kalender, Serie und die letzten Einheiten mit allen Sätzen.
 *
 * Eigene Suspense-Grenze auf der Verlaufsseite: hängt nur an der eigenen
 * Datenbank, nicht an Google, und soll nicht auf den Gewichtsteil warten.
 */
export async function Einheitenverlauf() {
  await connection();

  let einheiten: Einheitsbericht[];
  let tage: string[];
  try {
    [einheiten, tage] = await Promise.all([letzteEinheiten(12), trainingstage()]);
  } catch (e) {
    console.error("Einheiten nicht lesbar:", e);
    return null;
  }

  const heute = heuteWien();
  const raster = kalender(tage, heute, WOCHEN);
  const inSerie = serie(tage, heute);
  const dieseWoche = tage.filter((t) => montagVon(t) === montagVon(heute)).length;

  return (
    <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow>Training calendar</Eyebrow>
          <span className="text-[11px] text-fg-faint">{WOCHEN} Wochen</span>
        </div>

        <div className="mt-3.5 flex gap-6">
          <div>
            <Eyebrow>This week</Eyebrow>
            <p className="num mt-1 text-[22px]">
              {dieseWoche}
              <span className="text-xs font-medium text-fg-faint"> sessions</span>
            </p>
          </div>
          <div>
            <Eyebrow>Streak</Eyebrow>
            <p className="num mt-1 text-[22px]">
              {inSerie}
              <span className="text-xs font-medium text-fg-faint">
                {" "}
                {inSerie === 1 ? "week" : "weeks"}
              </span>
            </p>
          </div>
        </div>

        {/* Das Raster als Tabelle: ein Screenreader kann dann Zeile für Zeile
            lesen, statt 84 namenlose Kästchen vorzulesen. */}
        <table className="mt-4 w-full table-fixed border-separate border-spacing-[3px]" aria-label="Training days over the last twelve weeks">
          <thead>
            <tr>
              {WOCHENTAGE.map((t) => (
                <th key={t} scope="col" className="text-[10px] font-semibold text-fg-faint">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {raster.map((woche) => (
              <tr key={woche[0].iso}>
                {woche.map((tag) => (
                  <td key={tag.iso} className="p-0">
                    <span
                      title={`${kurzDatum(tag.iso)}${tag.einheiten > 0 ? " · trainiert" : ""}`}
                      className={`block h-[18px] rounded-[5px] ${
                        tag.zukunft
                          ? "border border-dashed border-hair-soft"
                          : tag.einheiten > 0
                            ? "bg-accent"
                            : "bg-surface-3"
                      } ${tag.iso === heute ? "outline outline-1 outline-offset-1 outline-fg-faint" : ""}`}
                    >
                      <span className="sr-only">
                        {kurzDatum(tag.iso)}: {tag.einheiten > 0 ? "trained" : tag.zukunft ? "upcoming" : "no training"}
                      </span>
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
          The streak counts weeks with at least {EINHEITEN_PRO_WOCHE} sessions — one missed
          day shouldn’t end it. The current week counts once it is complete.
        </p>
      </Card>

      <Card>
        <Eyebrow>Recent sessions</Eyebrow>
        {einheiten.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-fg-dim">
            No sessions logged yet.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-hair-soft">
            {einheiten.map((e) => (
              <li key={e.id}>
                <details className="group py-2.5">
                  <summary className="flex min-h-[40px] cursor-pointer list-none items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <b className="block text-[14px] font-semibold">
                        {e.art === "push" ? "Push" : "Pull"} · {kurzDatum(e.datum)}
                      </b>
                      <span className="block text-[11px] text-fg-faint">
                        {anzahl(e.uebungen.reduce((n, u) => n + u.saetze.length, 0), "set", "sets")}{" "}
                        · {Math.round(e.volumenKg).toLocaleString("en-GB")} kg
                        {e.dauerMin !== null && <> · {e.dauerMin} min</>}
                      </span>
                    </span>
                    <span aria-hidden className="text-fg-faint transition group-open:rotate-90">
                      ›
                    </span>
                  </summary>
                  <div className="mt-2 flex flex-col gap-1.5 pb-1">
                    {e.notiz && (
                      <p className="mb-1 border-l-2 border-accent/40 pl-2.5 text-[12px] italic leading-relaxed text-fg-dim">
                        {e.notiz}
                      </p>
                    )}
                    {e.uebungen.map((u) => (
                      <div key={u.name} className="flex items-baseline justify-between gap-3 text-[12px]">
                        <span className="min-w-0 truncate text-fg-dim">{u.name}</span>
                        <span className="shrink-0 tabular-nums text-fg-faint">
                          {u.saetze.map((s) => `${kgText(s.kg)}×${s.reps}`).join("  ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** 80 → "80", 82,5 → "82,5", 81,25 → "81,25" — so viele Stellen wie nötig. */
function kgText(kg: number): string {
  return String(Math.round(kg * 100) / 100);
}
