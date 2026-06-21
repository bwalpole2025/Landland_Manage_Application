-- Optional Postgres row-level-security policies (defense-in-depth).
--
-- Application-level tenant scoping in src/server/trpc.ts is the primary
-- enforcement. These policies add a second layer: every query must run with the
-- session GUC `app.current_account_id` set, and rows are filtered to that
-- account. Apply AFTER `prisma db push`:
--
--   psql "$DATABASE_URL" -f prisma/rls.sql
--
-- and set the GUC per request/transaction, e.g.:
--   SELECT set_config('app.current_account_id', $1, true);

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'Property', 'Tenancy', 'Tenant', 'Transaction',
    'Document', 'BankAccount', 'MtdObligation', 'MtdSubmission',
    'Notification', 'NotificationPreference', 'PushDevice', 'AuditLog'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON %I
      USING ("accountId" = current_setting('app.current_account_id', true))
      WITH CHECK ("accountId" = current_setting('app.current_account_id', true));
    $p$, tbl);
  END LOOP;
END $$;
