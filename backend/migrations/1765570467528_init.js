exports.shorthands = undefined;

exports.up = pgm => {
  // Users
  pgm.createTable('users', {
    id: { type: 'serial', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true, unique: true },
    hashed_password: { type: 'varchar(255)', notNull: true },
    role: { type: 'varchar(50)', default: 'user' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // Departments
  pgm.createTable('departments', {
    id: { type: 'serial', primaryKey: true },
    user_id: { type: 'integer', references: 'users(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    hashed_password: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, {
    constraints: {
        unique: ['user_id', 'name'] // Enforce unique department names per user if needed
    },
    ifNotExists: true
  });

  // Chats
  pgm.createTable('chats', {
    id: { type: 'serial', primaryKey: true },
    department_id: { type: 'integer', references: 'departments(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)' },
    title: { type: 'varchar(255)' }, // Code uses 'name', previous schema used 'title'. Keeping both or mapping. server.js uses 'name' mostly.
    hashed_password: { type: 'varchar(255)' },
    user_id: { type: 'integer', references: 'users(id)' }, // Added to match some code paths
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // Messages
  pgm.createTable('messages', {
    id: { type: 'serial', primaryKey: true },
    chat_id: { type: 'integer', references: 'chats(id)', onDelete: 'CASCADE' },
    role: { type: 'varchar(50)', notNull: true },
    content: { type: 'text', notNull: true },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // Chat Statuses
  pgm.createTable('chat_statuses', {
    chat_id: { type: 'integer', primaryKey: true, references: 'chats(id)', onDelete: 'CASCADE' },
    status: { type: 'varchar(50)', default: 'draft' },
  }, { ifNotExists: true });

  // Process Versions
  pgm.createTable('process_versions', {
    id: { type: 'serial', primaryKey: true },
    chat_id: { type: 'integer', references: 'chats(id)', onDelete: 'CASCADE' },
    process_text: { type: 'text' },
    mermaid_code: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // Comments
  pgm.createTable('comments', {
    id: { type: 'serial', primaryKey: true },
    chat_id: { type: 'integer', references: 'chats(id)', onDelete: 'CASCADE' },
    author_role: { type: 'varchar(50)' },
    text: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // Transcription Data
  pgm.createTable('transcription_data', {
    id: { type: 'serial', primaryKey: true },
    chat_id: { type: 'integer', unique: true, references: 'chats(id)', onDelete: 'CASCADE' },
    transcribed_text: { type: 'text' },
    final_text: { type: 'text' },
    status: { type: 'varchar(50)', default: 'pending_review' },
    updated_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // Session table for connect-pg-simple
  pgm.createTable('session', {
    sid: { type: 'varchar', notNull: true, collation: 'default', primaryKey: true }, // Added primaryKey here
    sess: { type: 'json', notNull: true },
    expire: { type: 'timestamp(6)', notNull: true }
  }, { ifNotExists: true });
  // Removed pgm.addConstraint('session', 'session_pkey', ...) as it is now in createTable

  pgm.createIndex('session', 'expire', { name: 'IDX_session_expire', ifNotExists: true });

  // Function: create_chat_with_status
  pgm.createFunction(
    'create_chat_with_status',
    [
      { name: 'department_id_arg', type: 'integer' },
      { name: 'name_arg', type: 'text' },
      { name: 'hashed_password_arg', type: 'text' }
    ],
    {
      returns: 'TABLE(id integer, department_id integer, name TEXT, hashed_password TEXT)',
      language: 'plpgsql',
      replace: true,
    },
    `DECLARE
    new_chat_id integer;
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
      { name: 'department_id_arg', type: 'integer' },
      { name: 'name_arg', type: 'text' },
      { name: 'hashed_password_arg', type: 'text' }
    ]);
  pgm.dropTable('session');
  pgm.dropTable('transcription_data');
  pgm.dropTable('comments');
  pgm.dropTable('process_versions');
  pgm.dropTable('chat_statuses');
  pgm.dropTable('messages');
  pgm.dropTable('chats');
  pgm.dropTable('departments');
  pgm.dropTable('users');
};
