-- RUNE DATABASE MIGRATION
-- Initial schema setup for Supabase PostgreSQL

-- Create runes table
CREATE TABLE IF NOT EXISTS runes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    self_destruct_at TIMESTAMPTZ,
    self_destruct_warning_sent BOOLEAN DEFAULT FALSE NOT NULL,
    is_destroyed BOOLEAN DEFAULT FALSE NOT NULL
);

-- Index on slug for rapid search
CREATE INDEX IF NOT EXISTS idx_runes_slug ON runes(slug);

-- Create workspaces table (supports up to 2 workspaces per rune for dual-password plausible deniability)
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rune_id UUID REFERENCES runes(id) ON DELETE CASCADE NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    verification_blob TEXT NOT NULL,
    verification_iv TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(rune_id, password_hash)
);

-- Create tabs table (representing rich-text pages inside workspaces)
CREATE TABLE IF NOT EXISTS tabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    encrypted_content TEXT NOT NULL,
    encrypted_title TEXT NOT NULL,
    iv TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index on workspace_id
CREATE INDEX IF NOT EXISTS idx_tabs_workspace ON tabs(workspace_id);

-- Create analytics_events table for anonymous statistics
CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL
);

-- Enable Row Level Security (RLS) or setup policies as appropriate
-- For our anonymous zero-knowledge design, public read/write to API is mapped,
-- but database records themselves are safe because they are fully encrypted.
