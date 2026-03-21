/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Включаем расширение для генерации UUID
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  // 2. Создаем таблицы (используем ifNotExists, чтобы не падать, если они есть)

  // USERS
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'varchar(255)', notNull: true, unique: true },
    hashed_password: { type: 'varchar(255)', notNull: true },
    role: { type: 'varchar(50)', default: 'user' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // DEPARTMENTS
  pgm.createTable('departments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', references: 'users', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    hashed_password: { type: 'varchar(255)', notNull: true },
    description: 'text',
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, {
    ifNotExists: true,
    constraints: { unique: ['user_id', 'name'] }
  });

  // CHATS
  pgm.createTable('chats', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    department_id: { type: 'uuid', references: 'departments', onDelete: 'CASCADE' },
    name: 'varchar(255)',
    title: 'varchar(255)',
    hashed_password: 'varchar(255)',
    user_id: { type: 'uuid', references: 'users' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // MESSAGES
  pgm.createTable('messages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    chat_id: { type: 'uuid', references: 'chats', onDelete: 'CASCADE' },
    role: { type: 'varchar(50)', notNull: true },
    content: { type: 'text', notNull: true },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // CHAT STATUSES
  pgm.createTable('chat_statuses', {
    chat_id: { type: 'uuid', primaryKey: true, references: 'chats', onDelete: 'CASCADE' },
    status: { type: 'varchar(50)', default: 'draft' },
  }, { ifNotExists: true });

  // PROCESS VERSIONS
  pgm.createTable('process_versions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    chat_id: { type: 'uuid', references: 'chats', onDelete: 'CASCADE' },
    process_text: 'text',
    mermaid_code: 'text',
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // COMMENTS
  pgm.createTable('comments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    chat_id: { type: 'uuid', references: 'chats', onDelete: 'CASCADE' },
    author_role: 'varchar(50)',
    text: 'text',
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // TRANSCRIPTION DATA
  pgm.createTable('transcription_data', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    chat_id: { type: 'uuid', unique: true, references: 'chats', onDelete: 'CASCADE' },
    transcribed_text: 'text',
    final_text: 'text',
    status: { type: 'varchar(50)', default: 'pending_review' },
    updated_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  }, { ifNotExists: true });

  // SESSION (ИСПРАВЛЕНО: убран collate)
  pgm.createTable('session', {
    sid: { type: 'varchar', primaryKey: true, notNull: true },
    sess: { type: 'json', notNull: true },
    expire: { type: 'timestamp(6)', notNull: true },
  }, { ifNotExists: true });

  pgm.createIndex('session', 'expire', { name: 'IDX_session_expire', ifNotExists: true });

  // FUNCTION (Адаптировано под UUID)
  pgm.createFunction(
    'create_chat_with_status',
    [
      { name: 'department_id_arg', type: 'uuid' },
      { name: 'name_arg', type: 'text' },
      { name: 'hashed_password_arg', type: 'text' }
    ],
    {
      returns: 'TABLE(id uuid, department_id uuid, name TEXT, hashed_password TEXT)',
      language: 'plpgsql',
      replace: true,
    },
    `DECLARE
      new_chat_id uuid;
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

exports.down = (pgm) => {
  // Down migration is optional if you only go forward, but good practice
  pgm.dropFunction('create_chat_with_status', [
    { name: 'department_id_arg', type: 'uuid' },
    { name: 'name_arg', type: 'text' },
    { name: 'hashed_password_arg', type: 'text' }
  ], { ifExists: true });
  pgm.dropTable('session', { ifExists: true });
  pgm.dropTable('transcription_data', { ifExists: true });
  pgm.dropTable('comments', { ifExists: true });
  pgm.dropTable('process_versions', { ifExists: true });
  pgm.dropTable('chat_statuses', { ifExists: true });
  pgm.dropTable('messages', { ifExists: true });
  pgm.dropTable('chats', { ifExists: true });
  pgm.dropTable('departments', { ifExists: true });
  pgm.dropTable('users', { ifExists: true });
};
