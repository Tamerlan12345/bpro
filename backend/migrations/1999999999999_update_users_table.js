/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('users', {
    full_name: { type: 'varchar(255)' },
    email: { type: 'varchar(255)', unique: true },
    department_id: { type: 'uuid', references: 'departments', onDelete: 'SET NULL' },
    role: { type: 'varchar(50)', default: 'user' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('users', ['full_name', 'email', 'department_id', 'role']);
};
