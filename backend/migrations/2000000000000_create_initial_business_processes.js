/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => pgm.createTable('initial_business_processes', {
  id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
  chat_id: { type: 'uuid', notNull: true, unique: true, references: 'chats', onDelete: 'CASCADE' },
  content: { type: 'text', notNull: true },
  created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
}, { ifNotExists: true });

exports.down = (pgm) => {
  pgm.dropTable('initial_business_processes');
};
