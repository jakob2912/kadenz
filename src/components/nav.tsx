"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string; d: string; auch?: string[] }[] = [
  {
    href: "/",
    label: "Today",
    d: "M12 2v3M4.9 6.9 7 9M19.1 6.9 17 9M2 15h20M6 15a6 6 0 0 1 12 0M3 20h18",
  },
  { href: "/training", label: "Training", d: "M4 9v6M7.5 6.5v11M16.5 6.5v11M20 9v6M7.5 12h9" },
  /* Essen direkt nach Training: beides ist das, was heute zu tun ist. Den
     Plan liest Jakob mehrmals täglich nach, und ein wartender
     Kalorienvorschlag braucht eine Stelle, an der er von selbst auffällt. */
  {
    href: "/ernaehrung",
    label: "Food",
    d: "M2.5 11.5h19a9.5 9.5 0 0 1-19 0M8.5 7.6c0-1.7 1.2-2 1.2-3.6M12.5 7.2c0-1.7 1.2-2 1.2-3.6M16.5 7.6c0-1.7 1.2-2 1.2-3.6",
  },
  /* Vier statt sechs Tabs. Bankdrücken lebt jetzt unter Verlauf (Umschalter
     oben auf beiden Seiten), der Coach steckt in der Startseite — seine drei
     Sätze standen dort ohnehin schon fast wörtlich. Bei sechs Einträgen
     blieben auf 375 px je 52 px, und "Verlauf" stand kurz vor dem Umbruch. */
  {
    href: "/verlauf",
    label: "History",
    d: "M3 3v18h18M7 15l4-4 3 3 5-6M19 8h-3M19 8v3",
    auch: ["/bank"],
  },
];

export function TabBar() {
  const path = usePathname();

  // Auf der Anmeldeseite führt jeder Tab ohnehin zurück auf sie.
  if (path === "/anmelden") return null;

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-hair-soft bg-ground/85 px-5 pt-2 backdrop-blur-xl
                 pb-[calc(0.5rem+env(safe-area-inset-bottom))]
                 md:bottom-auto md:top-0 md:border-t-0 md:border-b md:py-2.5"
    >
      <div className="mx-auto flex max-w-[520px] gap-1 md:max-w-[1180px] md:justify-end md:gap-1.5">
        {TABS.map((t) => {
          // Unterseiten zählen mit: /verlauf/bankdruecken und /bank sind
          // beide noch "Verlauf".
          const active =
            t.href === "/"
              ? path === "/"
              : [t.href, ...(t.auch ?? [])].some((h) => path === h || path.startsWith(h + "/"));
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
              <span className="whitespace-nowrap text-[11px] font-semibold md:text-[13px]">
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
