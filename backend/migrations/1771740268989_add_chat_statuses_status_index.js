/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createIndex('chat_statuses', 'status', {
    name: 'idx_chat_statuses_status',
    ifNotExists: true
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('chat_statuses', 'status', {
    name: 'idx_chat_statuses_status',
    ifExists: true
  });
};
