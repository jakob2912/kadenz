import Link from "next/link";
import type { ReactNode } from "react";

/* Gemeinsame Bausteine. Bewusst Server-Komponenten: nichts hier braucht
   Interaktivität, und alles, was serverseitig gerendert wird, steht sofort
   im HTML statt erst nach dem Hydrieren. */

export function Card({
  children,
  tone = "normal",
  className = "",
}: {
  children: ReactNode;
  tone?: "normal" | "warnung";
  className?: string;
}) {
  const border = tone === "warnung" ? "border-caution/30" : "border-hair";
  return (
    <section
      className={`rounded-lg border ${border} bg-gradient-to-b from-surface-2 to-surface p-5 ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * Sackgasse ohne Google-Verbindung auflösen.
 *
 * Bis hierher stand der Verbinden-Knopf nur auf der Startseite; wer über die
 * Tab-Leiste auf Verlauf oder Coach landete, las dort nur, dass keine
 * Verbindung besteht, ohne einen Weg heraus. Ein Grund ohne Ausweg ist keine
 * Fehlermeldung, sondern eine Wand.
 */
export function NichtVerbunden({
  titel,
  grund,
}: {
  titel: string;
  grund: string;
}) {
  return (
    <div className="mx-auto max-w-[520px] pt-10 md:pt-14">
      <Eyebrow>Kadenz</Eyebrow>
      <h1 className="mt-2 text-[27px] font-bold leading-tight tracking-[-0.025em]">{titel}</h1>
      <p className="mt-3 text-sm leading-relaxed text-fg-dim">{grund}</p>
      <Link
        href="/api/auth/google"
        className="mt-6 flex min-h-[52px] items-center justify-center rounded-md bg-accent
                   font-semibold text-on-accent transition active:scale-[0.98]"
      >
        Mit Google verbinden
      </Link>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
      {children}
    </p>
  );
}

export function Metric({
  label,
  value,
  delta,
  tone = "flat",
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: "gut" | "schlecht" | "warnung" | "flat";
}) {
  const color =
    tone === "gut"
      ? "text-ready"
      : tone === "schlecht"
        ? "text-strain"
        : tone === "warnung"
          ? "text-caution"
          : "text-fg-faint";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-fg-dim">{label}</span>
      <span className="whitespace-nowrap text-sm font-semibold">
        {value}
        {delta && <em className={`ml-1.5 text-[11px] not-italic ${color}`}>{delta}</em>}
      </span>
    </div>
  );
}

export function Tag({
  children,
  tone = "akzent",
}: {
  children: ReactNode;
  /* "schlecht" fehlte: ein Tag mit Regenerationsband "schlecht" bekam
     denselben amberfarbenen Tag wie ein mittelmäßiger — der schlechteste Tag
     der Woche sah aus wie ein durchschnittlicher. */
  tone?: "akzent" | "warnung" | "gut" | "schlecht";
}) {
  const map = {
    akzent: "text-accent border-accent/30 bg-accent/10",
    warnung: "text-caution border-caution/30 bg-caution/10",
    gut: "text-ready border-ready/30 bg-ready/10",
    schlecht: "text-strain border-strain/30 bg-strain/10",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] ${map[tone]}`}
    >
      <i className="block h-[5px] w-[5px] rounded-full bg-current" />
      {children}
    </span>
  );
}

/**
 * Regenerations-Ring. Der Bogen wird über stroke-dasharray gezeichnet und
 * serverseitig fertig gerendert — kein Aufblitzen eines leeren Rings.
 */
export function Gauge({
  score,
  band,
}: {
  score: number;
  band: "gut" | "mittel" | "schlecht";
}) {
  const R = 45;
  const C = 2 * Math.PI * R;
  const color =
    band === "gut"
      ? "var(--color-ready)"
      : band === "mittel"
        ? "var(--color-caution)"
        : "var(--color-strain)";

  return (
    <div className="relative h-[104px] w-[104px] shrink-0">
      <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90" aria-hidden>
        <circle cx="52" cy="52" r={R} fill="none" strokeWidth="7" stroke="var(--color-hair)" />
        <circle
          cx="52"
          cy="52"
          r={R}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={C}
          strokeDashoffset={C - (C * score) / 100}
          style={{ filter: `drop-shadow(0 0 7px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
        <b className="text-[31px] font-bold leading-none tracking-[-0.04em]">{score}</b>
        {/* "von 100" statt "bereit": der Coach-Screen nennt denselben Wert
            "X von 100". Zwei Namen für dieselbe Zahl auf zwei Screens zwingen
            zum Nachdenken, ob es dieselbe Zahl ist. */}
        <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-fg-faint">
          von 100
        </span>
      </div>
    </div>
  );
}

export function minToHm(min: number): string {
  return `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")} m`;
}

/**
 * Heutiger Tag als ISO, ausdrücklich in Wiener Zeit.
 *
 * Nicht die Serverzeit: auf Vercel laufen die Server in UTC, und zwischen
 * Mitternacht und 02:00 Wiener Zeit wäre "heute" dort noch der Vortag.
 */
export function heuteWien(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "Sa., 15. Aug." — kurz genug, um neben einer Zahl in einer Zeile zu stehen. */
export function kurzDatum(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-AT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Vienna",
  });
}

/**
 * Wie alt ist ein Messwert.
 *
 * "heute" und "gestern" sind die Antworten, an denen hängt, ob man der Zahl
 * glauben darf. Ein nacktes "2026-08-13" muss man erst gegen den Kalender
 * rechnen, um zu merken, dass der Wert drei Tage alt ist — und genau das tut
 * man verschlafen um sechs Uhr früh nicht.
 */
export function alterLabel(iso: string, heute = heuteWien()): string {
  const tage = Math.round(
    (Date.parse(`${heute}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 864e5
  );
  if (tage <= 0) return "heute";
  if (tage === 1) return "gestern";
  if (tage < 7) return `vor ${tage} Tagen`;
  return kurzDatum(iso);
}

export function de(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",");
}
