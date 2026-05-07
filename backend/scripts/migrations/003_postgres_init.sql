CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS wiki_units (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT NOT NULL,
    content TEXT NOT NULL,
    problem_ids TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT 'manual',
    source_url TEXT,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1,
    last_edited_by TEXT,
    embedding vector(1024),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS problems (
    problem_id TEXT PRIMARY KEY,
    problem_text TEXT NOT NULL,
    choices TEXT,
    correct_answer TEXT,
    topic TEXT NOT NULL,
    subtopic TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    problem_type TEXT NOT NULL,
    figure_svg TEXT,
    problem_hash TEXT,
    figure_type TEXT NOT NULL DEFAULT 'svg'
);

CREATE TABLE IF NOT EXISTS wiki_unit_history (
    id SERIAL PRIMARY KEY,
    unit_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    edited_by TEXT,
    reason TEXT,
    edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS unit_feedback (
    id SERIAL PRIMARY KEY,
    unit_id TEXT NOT NULL,
    problem_text TEXT,
    feedback_type TEXT NOT NULL DEFAULT 'general',
    comment TEXT,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flagged_solutions (
    id SERIAL PRIMARY KEY,
    problem_text TEXT NOT NULL,
    problem_hash TEXT NOT NULL,
    solver_output TEXT NOT NULL,
    flag_reason TEXT,
    reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wiki_drafts (
    draft_id TEXT PRIMARY KEY,
    source_url TEXT,
    source_text TEXT NOT NULL,
    proposed_units_json TEXT NOT NULL DEFAULT '[]',
    final_units_json TEXT,
    topic_hint TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS solution_logs (
    id SERIAL PRIMARY KEY,
    problem_text TEXT NOT NULL,
    problem_hash TEXT NOT NULL,
    classified_topic TEXT NOT NULL,
    retrieved_ids TEXT NOT NULL DEFAULT '[]',
    used_knowledge_ids TEXT NOT NULL DEFAULT '[]',
    solver_confidence TEXT NOT NULL DEFAULT 'medium',
    validation_valid BOOLEAN NOT NULL DEFAULT FALSE,
    validation_issues TEXT NOT NULL DEFAULT '[]',
    wiki_assisted BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staged_wiki_units (
    staged_id TEXT PRIMARY KEY,
    unit_data TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    source_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    proposed_by TEXT NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wiki_units_topic_idx ON wiki_units (topic);
CREATE INDEX IF NOT EXISTS wiki_units_deleted_idx ON wiki_units (deleted);
CREATE INDEX IF NOT EXISTS problems_hash_idx ON problems (problem_hash);
CREATE INDEX IF NOT EXISTS solution_logs_created_idx ON solution_logs (created_at);
CREATE INDEX IF NOT EXISTS staged_wiki_units_status_idx ON staged_wiki_units (status);

-- HNSW index for vector similarity search
-- Note: cannot use CONCURRENTLY inside a transaction; plain CREATE INDEX IF NOT EXISTS is used here
CREATE INDEX IF NOT EXISTS wiki_units_embedding_hnsw ON wiki_units USING hnsw (embedding vector_cosine_ops);
