-- Row-Level-Security an, und den Rollen der REST-Schnittstelle die Rechte weg
--
-- Befund vom 16.09.2026. Auf allen zehn Tabellen im Schema "public" stand RLS
-- aus, es gab keine einzige Policy, und die Rollen "anon" und "authenticated"
-- hatten SELECT, INSERT, UPDATE, DELETE und TRUNCATE auf jeder davon. Das sind
-- nicht selbst gesetzte Rechte, sondern Supabases Standard: was der Rolle
-- postgres im Schema public angelegt wird, bekommt sie automatisch mit -- auch
-- Tabellen, die Prisma ueber eine Migration erzeugt.
--
-- Warum das zaehlt: unter https://<projekt>.supabase.co/rest/v1/ laeuft
-- PostgREST oeffentlich, und es authentifiziert mit dem anon-Key. Der ist bei
-- Supabase ausdruecklich kein Geheimnis -- er ist dafuer gedacht, in Clients
-- ausgeliefert zu werden. Wer ihn hat, konnte lesen und schreiben. Betroffen
-- war damit auch "Einstellung", und dort liegt der Google-Refresh-Token: mit
-- ihm kommt man an Schlaf, Ruhepuls, HRV und Gewicht, und man kann Gewichte
-- nach Google Health zurueckschreiben.
--
-- Kadenz spricht die REST-Schnittstelle nie an. Die App, der MCP-Server und
-- die Migrationen laufen samt und sonders ueber Prisma auf einer direkten
-- Postgres-Verbindung als Rolle postgres. Die offenen Rechte waren also reine
-- Angriffsflaeche ohne Gegenwert.
--
-- Dass das hier gefahrlos geht, haengt an einer Eigenschaft der Rolle: postgres
-- hat rolbypassrls = true. RLS gilt fuer sie nicht, die App merkt von dieser
-- Migration also nichts. Waere sie eine gewoehnliche Rolle, haette
-- "RLS an, keine Policy" sie vollstaendig ausgesperrt.

-- ─────────────────────────────────────────────────────────────
-- 1. RLS auf allen bestehenden Tabellen
-- ─────────────────────────────────────────────────────────────
--
-- Ohne Policy heisst RLS "niemand ausser Eigentuemer und BYPASSRLS-Rollen".
-- Genau das ist gewollt: es gibt keinen Zugriff ueber PostgREST, der erlaubt
-- sein soll. Eine Policy waere eine Erlaubnis, und es gibt nichts zu erlauben.
--
-- Als Schleife und nicht als zehn ALTER-Zeilen: die Liste der Tabellen steht
-- im Prisma-Schema und aendert sich, und eine vergessene Zeile faellt nicht auf.

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. Die Rechte selbst entziehen
-- ─────────────────────────────────────────────────────────────
--
-- RLS allein genuegt zwar, aber es ist die zweite Schranke, nicht die erste.
-- PostgREST braucht BEIDES: ein Recht auf der Tabelle und eine Policy, die
-- die Zeile durchlaesst. Ohne Recht kommt es gar nicht erst bis zur Policy --
-- und ein spaeter versehentlich angelegtes "allow all" liefe ins Leere.
--
-- service_role und postgres bleiben unberuehrt. Die eine braucht den
-- service-Key, der im Gegensatz zum anon-Key ein echtes Geheimnis ist, die
-- andere ist die Verbindung der App selbst.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Und kuenftige Tabellen gar nicht erst ausstatten
-- ─────────────────────────────────────────────────────────────
--
-- Der wichtigste Teil, und der am leichtesten zu uebersehende. Ohne ihn
-- bekaeme die naechste von Prisma angelegte Tabelle dieselben Rechte wieder --
-- Supabases Standard-Vorgaben gelten fuer alles, was die Rolle postgres in
-- public erzeugt. Die Migration von heute waere dann in genau dem Moment
-- wertlos, in dem das Datenmodell waechst.
--
-- Damit ist auch der Fall abgedeckt, dass jemand bei einer neuen Tabelle
-- vergisst, RLS einzuschalten: ohne Recht nuetzt die fehlende Policy nichts.
-- (Ein Event-Trigger, der RLS automatisch setzt, waere die Alternative --
--  er braucht Superuser-Rechte, und die hat diese Rolle nicht.)

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
