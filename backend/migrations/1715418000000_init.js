exports.shorthands = undefined;

exports.up = pgm => {
  // Users
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true, unique: true },
    hashed_password: { type: 'text', notNull: true },
  });

  // Departments
  pgm.createTable('departments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', references: 'users(id)', onDelete: 'CASCADE' },
    name: { type: 'text', notNull: true },
    hashed_password: { type: 'text', notNull: true },
  }, {
    constraints: {
      unique: ['user_id', 'name']
    }
  });

  // Chats
  pgm.createTable('chats', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    department_id: { type: 'uuid', references: 'departments(id)', onDelete: 'CASCADE' },
    name: { type: 'text', notNull: true },
    hashed_password: { type: 'text', notNull: true },
  });

  // Process Versions
  pgm.createTable('process_versions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    chat_id: { type: 'uuid', references: 'chats(id)', onDelete: 'CASCADE' },
    process_text: { type: 'text' },
    mermaid_code: { type: 'text' },
    audio_source: { type: 'text' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });

  // Enums
  pgm.createType('author_role', ['user', 'admin']);
  pgm.createType('chat_status', ['draft', 'pending_review', 'needs_revision', 'completed', 'archived']);
  pgm.createType('transcription_status', ['pending_review', 'finalized']);

  // Comments
  pgm.createTable('comments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    chat_id: { type: 'uuid', references: 'chats(id)', onDelete: 'CASCADE' },
    author_role: { type: 'author_role', notNull: true },
    text: { type: 'text' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });

  // Chat Statuses
  pgm.createTable('chat_statuses', {
    chat_id: { type: 'uuid', primaryKey: true, references: 'chats(id)', onDelete: 'CASCADE' },
    status: { type: 'chat_status', default: 'draft' },
  });

  // Transcription Data
  pgm.createTable('transcription_data', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    chat_id: { type: 'uuid', unique: true, references: 'chats(id)', onDelete: 'CASCADE' },
    transcribed_text: { type: 'text' },
    final_text: { type: 'text' },
    status: { type: 'transcription_status', default: 'pending_review' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', default: pgm.func('now()') },
  });

  // Session table for connect-pg-simple
  pgm.createTable('session', {
    sid: { type: 'varchar', notNull: true, collation: 'default' },
    sess: { type: 'json', notNull: true },
    expire: { type: 'timestamp(6)', notNull: true }
  });
  pgm.addConstraint('session', 'session_pkey', { primaryKey: 'sid' });
  pgm.createIndex('session', 'expire', { name: 'IDX_session_expire' });

  // Function: create_chat_with_status
  pgm.createFunction(
    'create_chat_with_status',
    [
      { name: 'department_id_arg', type: 'uuid' },
      { name: 'name_arg', type: 'text' },
      { name: 'hashed_password_arg', type: 'text' }
    ],
    {
      returns: 'TABLE(id UUID, department_id UUID, name TEXT, hashed_password TEXT)',
      language: 'plpgsql',
      replace: true,
    },
    `DECLARE
    new_chat_id UUID;
BEGIN

    INSERT INTO chats (department_id, name, hashed_password)
    VALUES (department_id_arg, name_arg, hashed_password_arg)
    RETURNING chats.id INTO new_chat_id;


    INSERT INTO chat_statuses (chat_id, status)
    VALUES (new_chat_id, 'draft');


    RETURN QUERY
    SELECT c.id, c.department_id, c.name, c.hashed_password
    FROM chats c
    WHERE c.id = new_chat_id;
END;`
  );
};

exports.down = pgm => {
  pgm.dropFunction('create_chat_with_status', [
      { name: 'department_id_arg', type: 'uuid' },
      { name: 'name_arg', type: 'text' },
      { name: 'hashed_password_arg', type: 'text' }
    ]);
  pgm.dropTable('session');
  pgm.dropTable('transcription_data');
  pgm.dropTable('chat_statuses');
  pgm.dropTable('comments');
  pgm.dropType('transcription_status');
  pgm.dropType('chat_status');
  pgm.dropType('author_role');
  pgm.dropTable('process_versions');
  pgm.dropTable('chats');
  pgm.dropTable('departments');
  pgm.dropTable('users');
};
