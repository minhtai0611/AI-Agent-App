-- 002_add_source_url.sql
-- Adds nullable source_url TEXT column to wiki_units.
-- Idempotent: no-ops silently if column already exists.

SELECT CASE
    WHEN (SELECT COUNT(*) FROM pragma_table_info('wiki_units') WHERE name='source_url') = 0
    THEN (SELECT 1 WHERE (SELECT 1 FROM (SELECT wiki_units.* FROM wiki_units LIMIT 0)) IS NULL)
END;
-- The actual ALTER is executed conditionally by run_migration.py.
