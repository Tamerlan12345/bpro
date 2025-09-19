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

-- RPC function to create a chat and its status atomically
CREATE OR REPLACE FUNCTION create_chat_with_status(
    department_id_arg UUID,
    name_arg TEXT,
    hashed_password_arg TEXT
)
RETURNS TABLE(id UUID, department_id UUID, name TEXT, hashed_password TEXT) AS $$
DECLARE
    new_chat_id UUID;
BEGIN
    -- Insert the new chat and get its ID
    INSERT INTO chats (department_id, name, hashed_password)
    VALUES (department_id_arg, name_arg, hashed_password_arg)
    RETURNING chats.id INTO new_chat_id;

    -- Insert the initial status for the new chat
    INSERT INTO chat_statuses (chat_id, status)
    VALUES (new_chat_id, 'draft');

    -- Return the newly created chat record
    RETURN QUERY
    SELECT c.id, c.department_id, c.name, c.hashed_password
    FROM chats c
    WHERE c.id = new_chat_id;
END;
$$ LANGUAGE plpgsql;
