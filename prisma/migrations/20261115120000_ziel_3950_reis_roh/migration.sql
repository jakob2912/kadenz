-- Ziel 3.950 kcal: die Zahl an das angleichen, was der Plan wirklich liefert.
--
-- Anlass (Jakob, 15.11.2026): Reis und Reisflocken ("Reispudding") werden roh
-- bzw. trocken gewogen. Mit Standard-Packungswerten kommt der unveraenderte
-- Plan damit auf rund 3.950 kcal, 590 g Kohlenhydrate, 185 g Eiweiss und 80 g
-- Fett, also rund 250 kcal ueber dem bisherigen Ziel von 3.700. Gegessen wird
-- weiter genau derselbe Plan; nur das Ziel stimmt jetzt, damit der Coach (auch
-- der Vorschlag beim Wechsel in den Cut) von der echten Zufuhr aus rechnet.
--
-- Keine Mengen werden geaendert. Als neues von Hand gesetztes Ziel ist 590 g
-- zugleich die Basis der Skalierung, der Faktor bleibt also 1.
INSERT INTO "Ernaehrungsziel"
    ("id", "gueltigAb", "kcal", "kohlenhydrateG", "eiweissG", "fettG", "quelle", "begruendung")
VALUES
    ('ziel-3950', DATE '2026-11-15', 3950, 590, 185, 80, 'jakob',
     'Von Hand auf 3950 kcal gesetzt, damit das Ziel zum Plan passt: Reis und Reisflocken werden roh gewogen, der Plan liefert damit rund 3950 kcal, 590 g Kohlenhydrate, 185 g Eiweiss und 80 g Fett. Gegessen wird unveraendert derselbe Plan.');
