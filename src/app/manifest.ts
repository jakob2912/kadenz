import type { MetadataRoute } from "next";

/**
 * Macht Kadenz zur installierbaren PWA. Mit `display: "standalone"` startet
 * sie vom Home-Bildschirm ohne Browser-Leiste — der Unterschied zwischen
 * "Website im Safari" und "fühlt sich an wie eine App".
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kadenz",
    short_name: "Kadenz",
    description: "Persönlicher Trainings- und Ernährungscoach",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#090b0d",
    theme_color: "#090b0d",
    lang: "de-AT",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
