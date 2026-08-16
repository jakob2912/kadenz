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
      className={`rounded-[22px] border ${border} bg-gradient-to-b from-surface-2 to-surface p-5 ${className}`}
    >
      {children}
    </section>
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
  tone?: "akzent" | "warnung" | "gut";
}) {
  const map = {
    akzent: "text-accent border-accent/30 bg-accent/10",
    warnung: "text-caution border-caution/30 bg-caution/10",
    gut: "text-ready border-ready/30 bg-ready/10",
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
        <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-fg-faint">
          bereit
        </span>
      </div>
    </div>
  );
}

export function minToHm(min: number): string {
  return `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")} m`;
}

export function de(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",");
}
