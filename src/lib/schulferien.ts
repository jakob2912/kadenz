/**
 * Kadenz — Schulferien im Burgenland
 *
 * Nur für die Anzeige auf der Startseite ("Autumn break until 2 Nov").
 * Bis zum 28.10.2026 stand dort "Schulzeit" ab SCHULSTART und nichts sonst —
 * mitten in den Herbstferien. Das Kalorienziel hängt bewusst NICHT daran:
 * eine Ferienwoche soll den Plan nicht für sieben Tage umwerfen.
 *
 * Schuljahr 2026/27, Burgenland (Ferienregion Ost). Jeweils der erste und
 * der letzte schulfreie Tag, Wochenenden an den Rändern eingeschlossen.
 * Für 2027/28 muss die Liste ergänzt werden — danach zeigt die Startseite
 * schlicht "School".
 */
const FERIEN: readonly { name: string; von: string; bis: string }[] = [
  { name: "Summer break", von: "2026-07-04", bis: "2026-09-06" },
  // Herbstferien 27.–31.10., davor der Nationalfeiertag, danach Allerseelen.
  { name: "Autumn break", von: "2026-10-24", bis: "2026-11-02" },
  // Landespatron des Burgenlands: schulfrei.
  { name: "St. Martin's Day", von: "2026-11-11", bis: "2026-11-11" },
  { name: "Christmas break", von: "2026-12-24", bis: "2027-01-06" },
  { name: "Semester break", von: "2027-01-30", bis: "2027-02-07" },
  { name: "Easter break", von: "2027-03-20", bis: "2027-03-29" },
  { name: "Whitsun break", von: "2027-05-15", bis: "2027-05-18" },
  { name: "Summer break", von: "2027-07-03", bis: "2027-09-05" },
];

/** Die Ferien, in denen dieser Tag (ISO) liegt, oder null an einem Schultag. */
export function ferienAm(iso: string): { name: string; bis: string } | null {
  const f = FERIEN.find((x) => x.von <= iso && iso <= x.bis);
  return f ? { name: f.name, bis: f.bis } : null;
}
