exports.shorthands = undefined;

exports.up = (pgm) => {
  // Add index on chats.department_id
  pgm.createIndex('chats', 'department_id', { name: 'idx_chats_department_id', ifNotExists: true });

  // Add index on chats.user_id
  pgm.createIndex('chats', 'user_id', { name: 'idx_chats_user_id', ifNotExists: true });

  // Add index on messages.chat_id
  pgm.createIndex('messages', 'chat_id', { name: 'idx_messages_chat_id', ifNotExists: true });

  // Add index on process_versions.chat_id
  pgm.createIndex('process_versions', 'chat_id', { name: 'idx_process_versions_chat_id', ifNotExists: true });

  // Add index on comments.chat_id
  pgm.createIndex('comments', 'chat_id', { name: 'idx_comments_chat_id', ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropIndex('comments', 'chat_id', { name: 'idx_comments_chat_id', ifExists: true });
  pgm.dropIndex('process_versions', 'chat_id', { name: 'idx_process_versions_chat_id', ifExists: true });
  pgm.dropIndex('messages', 'chat_id', { name: 'idx_messages_chat_id', ifExists: true });
  pgm.dropIndex('chats', 'user_id', { name: 'idx_chats_user_id', ifExists: true });
  pgm.dropIndex('chats', 'department_id', { name: 'idx_chats_department_id', ifExists: true });
};
