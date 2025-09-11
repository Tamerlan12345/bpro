-- Create departments table
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL
);

-- Create chats table
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    hashed_password TEXT NOT NULL
);

-- Create process_versions table
CREATE TABLE process_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    process_text TEXT,
    mermaid_code TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create ENUM types
CREATE TYPE author_role AS ENUM ('user', 'admin');
-- The new, more descriptive status for chat workflows
CREATE TYPE chat_status AS ENUM ('draft', 'pending_review', 'needs_revision', 'completed', 'archived');

-- Create comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    author_role author_role NOT NULL,
    text TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create chat_statuses table
CREATE TABLE chat_statuses (
    chat_id UUID PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
    status chat_status DEFAULT 'draft'
);
