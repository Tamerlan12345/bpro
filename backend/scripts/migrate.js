const path = require('path');
const dns = require('node:dns');

dns.setDefaultResultOrder('ipv4first');

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

const { createDatabaseConfig } = require('../utils/databaseConfig');

async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required for migrations.');
    }

    const { default: runner } = await import('node-pg-migrate');
    const direction = process.argv[2] || 'up';
    const countArg = process.argv[3];
    const count = countArg && !Number.isNaN(Number(countArg)) ? Number(countArg) : undefined;

    const databaseUrl = createDatabaseConfig(process.env.DATABASE_URL, process.env.NODE_ENV, {
        databaseSsl: process.env.DATABASE_SSL,
        databaseSslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
        pgssl: process.env.PGSSL,
        pgsslRejectUnauthorized: process.env.PGSSLREJECTUNAUTHORIZED
    });

    await runner({
        databaseUrl,
        dir: path.join(__dirname, '..', 'migrations'),
        direction,
        count,
        migrationsTable: 'pgmigrations',
        verbose: false
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
