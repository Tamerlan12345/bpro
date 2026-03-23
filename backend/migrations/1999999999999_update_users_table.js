/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name varchar(255);`);
  pgm.sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email varchar(255);`);
  pgm.sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;`);
  pgm.sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar(50) DEFAULT 'user';`);
  pgm.sql(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);`);
};

exports.down = (pgm) => {
  pgm.dropColumns('users', ['full_name', 'email', 'department_id', 'role']);
};
