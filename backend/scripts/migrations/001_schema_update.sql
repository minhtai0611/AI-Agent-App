-- 001_schema_update.sql
-- Comprehensive schema update for Math Wiki System maturation (Phase 1-4)
-- Designed to be idempotent: safe to run multiple times.

-- 1. Create new tables (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS unit_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wiki_unit_id TEXT,
    problem_text TEXT NOT NULL,
    issue_type TEXT CHECK(issue_type IN ('wrong', 'unclear', 'outdated', 'other')),
    user_comment TEXT,
    solver_output_json TEXT,
    validation_result_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_feedback_unit ON unit_feedback(wiki_unit_id, resolved);

CREATE TABLE IF NOT EXISTS flagged_solutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_text TEXT NOT NULL,
    solver_output_json TEXT NOT NULL,
    validation_result_json TEXT NOT NULL,
    used_knowledge_ids TEXT NOT NULL,
    flagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS wiki_unit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wiki_unit_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    source TEXT NOT NULL,
    edited_by TEXT DEFAULT 'system',
    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    change_reason TEXT,
    FOREIGN KEY(wiki_unit_id) REFERENCES wiki_units(id)
);
CREATE INDEX IF NOT EXISTS idx_history_unit ON wiki_unit_history(wiki_unit_id, version);

CREATE TABLE IF NOT EXISTS solution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_text TEXT NOT NULL,
    problem_hash TEXT NOT NULL,
    classified_topic TEXT NOT NULL,
    retrieved_ids TEXT NOT NULL,
    used_knowledge_ids TEXT NOT NULL,
    solver_confidence TEXT NOT NULL,
    validation_valid BOOLEAN NOT NULL,
    validation_issues TEXT,
    wiki_assisted BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_logs_created ON solution_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_unit_usage ON solution_logs(used_knowledge_ids);

CREATE TABLE IF NOT EXISTS wiki_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    draft_id TEXT UNIQUE NOT NULL,
    source_url TEXT,
    source_text TEXT NOT NULL,
    proposed_units_json TEXT NOT NULL,
    topic_hint TEXT,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    final_units_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add new columns to wiki_units (conditional)
-- Note: SQLite does not support IF NOT EXISTS on ADD COLUMN.
-- Applications should check PRAGMA table_info before executing each ALTER.
-- Alternatively, wrap each in a BEGIN/EXCEPTION block if using sqlite3 CLI.

-- Columns to add: source (already present in running system after initial migration), created_at, updated_at, deleted, version, last_edited_by

-- For manual execution, uncomment and run if column missing:
/*
ALTER TABLE wiki_units ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE wiki_units ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE wiki_units ADD COLUMN deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE wiki_units ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE wiki_units ADD COLUMN last_edited_by TEXT DEFAULT 'system';
*/

-- 3. Create indexes for new columns if needed
CREATE INDEX IF NOT EXISTS idx_active_units ON wiki_units(deleted);
CREATE INDEX IF NOT EXISTS idx_unit_version ON wiki_units(version);

-- 4. Backfill existing rows (if columns just added)
-- Ensure no NULL values break queries:
-- UPDATE wiki_units SET deleted = FALSE WHERE deleted IS NULL;
-- UPDATE wiki_units SET version = 1 WHERE version IS NULL;
-- UPDATE wiki_units SET last_edited_by = 'system' WHERE last_edited_by IS NULL;

-- Migration complete.
