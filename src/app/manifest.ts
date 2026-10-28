import type { MetadataRoute } from "next";

/**
 * Macht Kadenz zur installierbaren PWA. Mit `display: "standalone"` startet
 * sie vom Home-Bildschirm ohne Browser-Leiste — der Unterschied zwischen
 * "Website im Safari" und "fühlt sich an wie eine App".
 *
 * Die PNG-Icons stehen neben dem SVG, weil iOS SVG als Home-Bildschirm-Icon
 * nicht nimmt: mit nur dem SVG legte Safari einen verkleinerten Screenshot der
 * Seite auf den Home-Bildschirm. Das 180er-Icon für iOS selbst liegt als
 * src/app/apple-icon.png, Next setzt den apple-touch-icon-Link von allein.
 * Die PNGs sind aus public/icon.svg gerendert, ohne die abgerundeten Ecken —
 * iOS und Android runden selbst, und eigene Ecken ergäben schwarze Zwickel.
 *
 * `shortcuts` erscheinen auf Android bei langem Druck aufs Icon; iOS ignoriert
 * sie, schadet dort also nichts.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Kadenz",
    short_name: "Kadenz",
    description: "Personal training and nutrition coach",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#090b0d",
    theme_color: "#090b0d",
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Training", url: "/training", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Food", url: "/ernaehrung", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
