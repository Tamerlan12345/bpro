exports.shorthands = undefined;

exports.up = pgm => {
  // 1. Обязательно включаем pgcrypto для работы с UUID
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  // Users
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') }, // БЫЛО: serial
    name: { type: 'varchar(255)', notNull: true, unique: true },
    hashed_password: { type: 'varchar(255)', notNull: true },
    role: { type: 'varchar(50)', default: 'user' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // Departments
  pgm.createTable('departments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') }, // БЫЛО: serial
    user_id: {
      type: 'uuid', // БЫЛО: integer
      references: 'users',
      onDelete: 'CASCADE',
    },
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
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') }, // БЫЛО: serial
    department_id: {
      type: 'uuid', // БЫЛО: integer
      references: 'departments',
      onDelete: 'CASCADE',
    },
    name: { type: 'varchar(255)' },
    title: { type: 'varchar(255)' }, // Code uses 'name', previous schema used 'title'. Keeping both or mapping. server.js uses 'name' mostly.
    hashed_password: { type: 'varchar(255)' },
    user_id: { type: 'uuid', references: 'users' }, // Added to match some code paths. БЫЛО: integer
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // Messages
  pgm.createTable('messages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') }, // БЫЛО: serial
    chat_id: {
      type: 'uuid', // БЫЛО: integer
      references: 'chats',
      onDelete: 'CASCADE',
    },
    role: { type: 'varchar(50)', notNull: true },
    content: { type: 'text', notNull: true },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // Chat Statuses
  pgm.createTable('chat_statuses', {
    chat_id: { type: 'uuid', primaryKey: true, references: 'chats(id)', onDelete: 'CASCADE' }, // БЫЛО: integer
    status: { type: 'varchar(50)', default: 'draft' },
  }, { ifNotExists: true });

  // Process Versions
  pgm.createTable('process_versions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') }, // БЫЛО: serial
    chat_id: { type: 'uuid', references: 'chats(id)', onDelete: 'CASCADE' }, // БЫЛО: integer
    process_text: { type: 'text' },
    mermaid_code: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // Comments
  pgm.createTable('comments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') }, // БЫЛО: serial
    chat_id: { type: 'uuid', references: 'chats(id)', onDelete: 'CASCADE' }, // БЫЛО: integer
    author_role: { type: 'varchar(50)' },
    text: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // Transcription Data
  pgm.createTable('transcription_data', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') }, // БЫЛО: serial
    chat_id: { type: 'uuid', unique: true, references: 'chats(id)', onDelete: 'CASCADE' }, // БЫЛО: integer
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
      { name: 'department_id_arg', type: 'uuid' }, // БЫЛО: integer
      { name: 'name_arg', type: 'text' },
      { name: 'hashed_password_arg', type: 'text' }
    ],
    {
      returns: 'TABLE(id uuid, department_id uuid, name TEXT, hashed_password TEXT)', // БЫЛО: integer
      language: 'plpgsql',
      replace: true,
    },
    `DECLARE
    new_chat_id uuid; -- БЫЛО: integer
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
  pgm.dropTable('comments');
  pgm.dropTable('process_versions');
  pgm.dropTable('chat_statuses');
  pgm.dropTable('messages');
  pgm.dropTable('chats');
  pgm.dropTable('departments');
  pgm.dropTable('users');
  pgm.dropExtension('pgcrypto');
};
