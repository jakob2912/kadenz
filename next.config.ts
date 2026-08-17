import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Baut nach NEXT_DIST_DIR, falls gesetzt — sonst nach .next.
   *
   * .env.example versprach diese Umlenkung bereits ("Lenkt einen
   * Produktionsbau in ein anderes Verzeichnis, damit er ein parallel
   * laufendes `next dev` nicht überschreibt"), nur hat sie niemand
   * eingebaut: Next kennt von sich aus nur das interne __NEXT_DIST_DIR und
   * fällt sonst auf .next zurück. Ein `NEXT_DIST_DIR=.next-build next build`
   * schrieb damit trotzdem nach .next und riss dem laufenden Dev-Server das
   * Verzeichnis unter den Füßen weg — genau das, was der Hinweis verhindern
   * sollte.
   *
   * Auf Vercel ist die Variable nicht gesetzt, dort bleibt es bei .next.
   */
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
};

export default nextConfig;
