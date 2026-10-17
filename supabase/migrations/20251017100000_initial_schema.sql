-- Re-EL Scribbler Initial Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  display_name TEXT,
  avatar_path TEXT,
  preferred_language TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'light',
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID,
  title TEXT NOT NULL,
  subtitle TEXT,
  author_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  language TEXT DEFAULT 'en',
  status TEXT DEFAULT 'in_progress',
  cover_asset_id UUID,
  settings JSONB DEFAULT '{}'::jsonb,
  word_count BIGINT DEFAULT 0,
  target_word_count BIGINT DEFAULT 0,
  revision BIGINT DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES book_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  section_type TEXT DEFAULT 'chapter',
  position INTEGER DEFAULT 0,
  numbering_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_id UUID REFERENCES book_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT DEFAULT 'flow',
  content_json JSONB DEFAULT '{"type": "doc", "content": []}'::jsonb,
  layout_json JSONB DEFAULT '{}'::jsonb,
  revision BIGINT DEFAULT 0,
  word_count BIGINT DEFAULT 0,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id UUID,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES book_documents(id) ON DELETE CASCADE,
  revision BIGINT DEFAULT 0,
  snapshot JSONB DEFAULT '{}'::jsonb,
  label TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reference_type TEXT DEFAULT 'book',
  authors JSONB DEFAULT '[]'::jsonb,
  title TEXT NOT NULL,
  publication_year INTEGER,
  publisher TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  citation_style TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES book_documents(id) ON DELETE CASCADE,
  author_id UUID,
  content TEXT,
  anchor_data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID,
  format TEXT DEFAULT 'pdf',
  status TEXT DEFAULT 'pending',
  source_revision BIGINT,
  settings JSONB DEFAULT '{}'::jsonb,
  storage_path TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_deleted ON projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_book_sections_project ON book_sections(project_id);
CREATE INDEX IF NOT EXISTS idx_book_documents_project ON book_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_book_documents_section ON book_documents(section_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_project ON project_assets(project_id);
