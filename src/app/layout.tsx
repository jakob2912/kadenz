import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TabBar } from "@/components/nav";

export const metadata: Metadata = {
  title: "Kadenz",
  description: "Persönlicher Trainings- und Ernährungscoach",
  appleWebApp: { capable: true, title: "Kadenz", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#090b0d",
  // viewportFit deckt die Safe Areas auf dem iPhone ab, damit die
  // Tab-Leiste nicht unter dem Home-Indicator klebt.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full">
      <body className="min-h-full">
        {/* Ambientes Licht im Hintergrund — rein dekorativ, daher aria-hidden
            und pointer-events-none, damit es keine Klicks abfängt. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <span className="absolute -left-[18%] -top-[22%] block h-[70vw] max-h-[520px] w-[70vw] max-w-[520px] rounded-full bg-accent/15 blur-[90px]" />
          {/* Zweiter Schein in Eisblau statt Amber: Amber ist in dieser App
              Regenerationszustand. Als dauerhafte Deko im Hintergrund würde es
              den Signalwert der amberfarbenen Warnkarten aufbrauchen. */}
          <span className="absolute -bottom-[14%] -right-[22%] block h-[60vw] max-h-[440px] w-[60vw] max-w-[440px] rounded-full bg-accent-deep/10 blur-[90px]" />
        </div>

        {/* Die Statusleisten-Höhe sitzt als Polsterung am body (globals.css),
            nicht hier: klebende Kopfleisten messen sich an der
            Bildschirmkante und müssen sie eigens abziehen können. */}
        <main className="relative z-10 mx-auto max-w-[1180px] px-5 pb-28 md:pb-10 md:pt-16">
          {children}
        </main>

        <TabBar />
      </body>
    </html>
  );
}
