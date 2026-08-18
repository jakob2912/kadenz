"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Heute",
    d: "M12 2v3M4.9 6.9 7 9M19.1 6.9 17 9M2 15h20M6 15a6 6 0 0 1 12 0M3 20h18",
  },
  { href: "/training", label: "Training", d: "M4 9v6M7.5 6.5v11M16.5 6.5v11M20 9v6M7.5 12h9" },
  /* Fünfter Eintrag statt einer Unterseite des Coaches: den Plan liest Jakob
     mehrmals täglich nach ("was gehört in Meal 3?"), und ein wartender
     Kalorienvorschlag braucht eine Stelle, an der er von selbst auffällt.
     Zwei Tipps tief unter "Coach" wäre beides verfehlt.

     Eingeordnet nach Training, nicht hinten angehängt: Training und Essen sind
     das, was heute zu tun ist, Verlauf und Coach das, was daraus folgt. Die
     App ist zwei Tage alt — die Reihenfolge jetzt zu ordnen kostet weniger als
     später. */
  {
    href: "/ernaehrung",
    label: "Essen",
    d: "M2.5 11.5h19a9.5 9.5 0 0 1-19 0M8.5 7.6c0-1.7 1.2-2 1.2-3.6M12.5 7.2c0-1.7 1.2-2 1.2-3.6M16.5 7.6c0-1.7 1.2-2 1.2-3.6",
  },
  { href: "/verlauf", label: "Verlauf", d: "M3 3v18h18M7 15l4-4 3 3 5-6M19 8h-3M19 8v3" },
  {
    href: "/coach",
    label: "Coach",
    d: "M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.9 8.9 0 0 1-3.8-.8L3 21l1.9-5.4A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z",
  },
];

export function TabBar() {
  const path = usePathname();

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-hair-soft bg-ground/85 px-5 pt-2 backdrop-blur-xl
                 pb-[calc(0.5rem+env(safe-area-inset-bottom))]
                 md:bottom-auto md:top-0 md:border-t-0 md:border-b md:py-2.5"
    >
      <div className="mx-auto flex max-w-[520px] gap-1 md:max-w-[1180px] md:justify-end md:gap-1.5">
        {TABS.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              /* Inaktive Beschriftungen liefen auf text-fg-faint: 10px fett bei
                 3,55:1 gegen den Grund. Die kleinste Schrift der App war
                 gleichzeitig die kontrastärmste — auf fg-dim sind es 7,6:1.
                 active: statt nur hover:, weil es auf dem Handy kein Hover
                 gibt und der Tipp sonst ohne jede Rückmeldung bleibt. */
              className={`flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1 rounded-md transition-colors
                          md:min-h-[42px] md:flex-none md:flex-row md:gap-2 md:px-4
                          ${
                            active
                              ? "bg-accent/10 text-accent"
                              : "text-fg-dim active:bg-surface-2 active:text-fg md:hover:text-fg"
                          }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-[21px] w-[21px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.85"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d={t.d} />
              </svg>
              <span className="text-[10px] font-semibold md:text-[13px]">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
