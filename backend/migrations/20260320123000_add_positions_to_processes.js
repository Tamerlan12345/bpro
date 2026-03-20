/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE "business_processes" 
    ADD COLUMN IF NOT EXISTS "x" double precision DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS "y" double precision DEFAULT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.dropColumns('business_processes', ['x', 'y'], { ifExists: true });
};
