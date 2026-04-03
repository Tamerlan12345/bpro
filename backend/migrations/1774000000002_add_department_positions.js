/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Add coordinates, dimensions, and color to departments
  pgm.addColumns('departments', {
    x: { type: 'double precision', default: null },
    y: { type: 'double precision', default: null },
    width: { type: 'double precision', default: null },
    height: { type: 'double precision', default: null },
    color: { type: 'varchar(50)', default: null }
  }, { ifNotExists: true });

  // Add is_manual to process_relations
  pgm.addColumns('process_relations', {
    is_manual: { type: 'boolean', default: false }
  }, { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropColumns('process_relations', ['is_manual'], { ifExists: true });
  pgm.dropColumns('departments', ['x', 'y', 'width', 'height', 'color'], { ifExists: true });
};
