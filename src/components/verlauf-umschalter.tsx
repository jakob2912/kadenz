import Link from "next/link";

/**
 * Oben auf Verlauf und Bankdrücken: die beiden Seiten teilen sich seit der
 * Vier-Tab-Leiste einen Tab. Ein Umschalter statt eines Links im Text, damit
 * man auf einen Blick sieht, dass es die zweite Ansicht gibt — und von beiden
 * Seiten aus mit einem Tipp zur anderen kommt.
 */
export function VerlaufUmschalter({ aktiv }: { aktiv: "koerper" | "bank" }) {
  const eintraege = [
    { href: "/verlauf", label: "Body & strength", id: "koerper" },
    { href: "/bank", label: "Bench press", id: "bank" },
  ] as const;

  return (
    <nav aria-label="History" className="pt-6 md:pt-12">
      <div className="inline-flex rounded-lg border border-hair bg-surface-2 p-1">
        {eintraege.map((e) => {
          const an = e.id === aktiv;
          return (
            <Link
              key={e.id}
              href={e.href}
              aria-current={an ? "page" : undefined}
              className={`flex min-h-[44px] items-center rounded-md px-4 text-[13px] font-semibold transition-colors ${
                an ? "bg-accent/10 text-accent" : "text-fg-dim active:text-fg"
              }`}
            >
              {e.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
