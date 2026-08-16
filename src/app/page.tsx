import Link from "next/link";
import { loadDashboard } from "@/lib/health-service";
import { GewichtEingabe } from "@/components/gewicht-eingabe";
import { Card, Eyebrow, Gauge, Metric, Tag, de, minToHm } from "@/components/ui";

// Gesundheitsdaten ändern sich täglich und hängen am Cookie — nie cachen.
export const dynamic = "force-dynamic";

export default async function Heute() {
  const data = await loadDashboard(30);

  if (!data.verbunden) {
    return (
      <div className="mx-auto max-w-[520px] pt-16">
        <Eyebrow>Kadenz</Eyebrow>
        <h1 className="mt-2 text-[27px] font-bold leading-tight tracking-[-0.025em]">
          Erst mit Google Health verbinden
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-dim">{data.grund}</p>
        <Link
          href="/api/auth/google"
          className="mt-6 flex min-h-[52px] items-center justify-center rounded-2xl bg-accent
                     font-semibold text-on-accent transition active:scale-[0.98]"
        >
          Mit Google verbinden
        </Link>
      </div>
    );
  }

  const { heute, baseline, gewicht } = data;
  const heuteDatum = new Date().toLocaleDateString("de-AT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <header className="pt-10 md:pt-14">
        <Eyebrow>{heuteDatum} · Ferien bis 7. September</Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold leading-tight tracking-[-0.025em] md:text-[33px]">
          {gruss()}, Jakob
        </h1>
      </header>

      <div className="mt-7 grid items-start gap-4 md:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col gap-3.5">
          {heute && baseline ? (
            <Card>
              <div className="flex items-center justify-between gap-3">
                <Eyebrow>Regeneration</Eyebrow>
                <Tag tone={heute.regeneration.band === "gut" ? "gut" : "warnung"}>
                  {heute.regeneration.band === "gut" ? "erholt" : "erholt sich"}
                </Tag>
              </div>

              <div className="mt-3.5 flex items-center gap-5">
                <Gauge score={heute.regeneration.score} band={heute.regeneration.band} />
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  <Metric
                    label="Schlaf"
                    value={minToHm(heute.sleepMin)}
                    delta={deltaLabel(heute.sleepMin - baseline.sleepMin, "min")}
                    tone={heute.sleepMin >= baseline.sleepMin ? "gut" : "warnung"}
                  />
                  <Metric
                    label="Tiefschlaf"
                    value={`${heute.deepMin} min`}
                    delta={deltaLabel(heute.deepMin - baseline.deepMin, "min")}
                    tone={heute.deepMin >= baseline.deepMin ? "gut" : "schlecht"}
                  />
                  <Metric
                    label="Ruhepuls"
                    value={`${heute.restingHr} bpm`}
                    delta={deltaLabel(heute.restingHr - baseline.restingHr, "")}
                    tone={heute.restingHr <= baseline.restingHr ? "gut" : "schlecht"}
                  />
                  <Metric
                    label="HRV"
                    value={`${de(heute.hrv)} ms`}
                    delta={deltaLabel(heute.hrv - baseline.hrv, "")}
                    tone={heute.hrv >= baseline.hrv ? "gut" : "schlecht"}
                  />
                </div>
              </div>

              <p className="mt-3.5 flex items-center gap-1.5 text-[11px] text-fg-faint">
                <i className="block h-[5px] w-[5px] rounded-full bg-ready" />
                Fitbit Air · Referenz aus {data.tagesreihe.length} ausgewerteten Nächten
              </p>
            </Card>
          ) : (
            <Card>
              <Eyebrow>Regeneration</Eyebrow>
              <p className="mt-2 text-sm text-fg-dim">
                Noch keine vollständige Nacht mit Ruhepuls und HRV.
              </p>
            </Card>
          )}

          {heute && baseline && (
            <Card tone={heute.regeneration.band === "gut" ? "normal" : "warnung"}>
              <div className="flex items-start gap-3.5">
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br
                             from-accent to-accent-deep text-xs font-extrabold text-on-accent"
                  aria-hidden
                >
                  K
                </div>
                <div className="text-sm leading-relaxed text-fg-dim">
                  {coachText(heute.regeneration, heute.restingHr - baseline.restingHr)}
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <GewichtEingabe
            aktuell={gewicht.aktuell?.kg ?? null}
            datum={gewicht.aktuell?.date ?? null}
            schnitt7={gewicht.schnitt7}
          />

          <Card tone={gewicht.trend.usable ? "normal" : "warnung"}>
            <Eyebrow>Trend</Eyebrow>
            {gewicht.trend.usable ? (
              <>
                <p className="num mt-2 text-[27px]">
                  {gewicht.trend.kgPerWeek > 0 ? "+" : ""}
                  {de(gewicht.trend.kgPerWeek, 2)}
                  <span className="ml-1 text-xs font-medium text-fg-faint">kg / Woche</span>
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
                  Zielkorridor 0,25–0,50 kg pro Woche.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-fg-dim">{gewicht.trend.detail}</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/**
 * Tageszeitabhängiger Gruß.
 *
 * Die Stunde wird ausdrücklich in Wiener Zeit bestimmt, nicht aus der
 * Serverzeit: auf Vercel laufen die Server in UTC, und dort stünde um
 * 8 Uhr früh sonst "Gute Nacht".
 */
function gruss(): string {
  const stunde = Number(
    new Intl.DateTimeFormat("de-AT", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/Vienna",
    }).format(new Date())
  );

  if (stunde >= 5 && stunde < 11) return "Guten Morgen";
  if (stunde >= 11 && stunde < 18) return "Guten Tag";
  if (stunde >= 18 && stunde < 22) return "Guten Abend";
  return "Gute Nacht";
}

function deltaLabel(diff: number, unit: string): string {
  const rounded = Math.round(diff * 10) / 10;
  if (Math.abs(rounded) < 0.05) return "±0";
  const sign = rounded > 0 ? "+" : "−";
  const digits = Math.abs(rounded) < 10 ? 1 : 0;
  return `${sign}${de(Math.abs(rounded), digits)}${unit ? " " + unit : ""}`;
}

/** Text aus dem tatsächlichen Befund — nicht aus einer Liste von Floskeln. */
function coachText(
  v: { band: string; allowLifting: boolean; allowCardio: boolean; drivers: string[] },
  hrElevation: number
) {
  if (v.band === "gut") {
    return (
      <p>
        <b className="font-semibold text-fg">Volle Freigabe.</b> Deine Werte liegen auf
        Normalniveau — Training läuft wie geplant, Cardio ist frei.
      </p>
    );
  }

  return (
    <>
      <p>
        <b className="font-semibold text-fg">
          {v.allowLifting ? "Krafttraining ja, Cardio nein." : "Heute nur locker."}
        </b>{" "}
        Dein Ruhepuls liegt {de(hrElevation, 1)} Schläge über deinem Normalwert
        {v.drivers.length > 1 ? `, dazu ${v.drivers.slice(1).join(" und ")}` : ""}.
      </p>
      <p className="mt-2.5">
        Krafttraining belastet vor allem lokal und verträgt das. Zusätzliche
        Ausdauerbelastung würde die Erholung verzögern, ohne dir im Aufbau etwas zu bringen —
        die kommt zurück, sobald Ruhepuls und HRV wieder stehen.
      </p>
    </>
  );
}
