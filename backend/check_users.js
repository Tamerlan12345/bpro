const pg = require('pg');
const { Pool } = pg;

const pool = new Pool({
    connectionString: "postgresql://postgres.cwmraliqxghpbxnilkff:Qhsid23sjd02KlOl23@aws-1-eu-north-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
});

async function checkUsers() {
    try {
        const res = await pool.query('SELECT id, name, full_name, email, role FROM users');
        console.log('Current users:');
        console.table(res.rows);
    } catch (err) {
        console.error('Error querying users:', err);
    } finally {
        await pool.end();
    }
}

checkUsers();
