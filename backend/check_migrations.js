const pg = require('pg');
const { Pool } = pg;

const pool = new Pool({
    connectionString: "postgresql://postgres.cwmraliqxghpbxnilkff:Qhsid23sjd02KlOl23@aws-1-eu-north-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
});

async function checkMigrations() {
    try {
        const res = await pool.query('SELECT name, run_on FROM pgmigrations ORDER BY run_on DESC');
        console.log('Applied migrations:');
        console.table(res.rows);
    } catch (err) {
        console.error('Error querying pgmigrations:', err);
    } finally {
        await pool.end();
    }
}

checkMigrations();
