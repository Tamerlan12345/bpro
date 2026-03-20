/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('business_processes', {
    x: { type: 'double precision', default: null },
    y: { type: 'double precision', default: null },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('business_processes', ['x', 'y']);
};
