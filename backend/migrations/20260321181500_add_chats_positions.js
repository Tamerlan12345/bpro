exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.addColumns('chats', {
        x: { type: 'double precision', default: null },
        y: { type: 'double precision', default: null },
    }, { ifNotExists: true });
};

exports.down = (pgm) => {
    pgm.dropColumns('chats', ['x', 'y'], { ifExists: true });
};