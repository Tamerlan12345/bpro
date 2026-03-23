const { createDatabaseConfig } = require('../utils/databaseConfig');

describe('createDatabaseConfig', () => {
    test('disables ssl outside production by default', () => {
        const config = createDatabaseConfig('postgresql://user:pass@localhost:5432/db', 'development');

        expect(config.ssl).toBe(false);
        expect(config.host).toBe('localhost');
        expect(config.database).toBe('db');
    });

    test('uses non-verifying ssl in production by default', () => {
        const config = createDatabaseConfig('postgresql://user:pass@db.example.com:5432/app', 'production');

        expect(config.ssl).toEqual({ rejectUnauthorized: false });
    });

    test('respects explicit ssl disable flag', () => {
        const config = createDatabaseConfig(
            'postgresql://user:pass@db.example.com:5432/app',
            'production',
            { databaseSsl: 'false' }
        );

        expect(config.ssl).toBe(false);
    });
});
