const pg = require('pg');
const { Pool } = pg;

const pool = new Pool({
    connectionString: "postgresql://postgres.cwmraliqxghpbxnilkff:Qhsid23sjd02KlOl23@aws-1-eu-north-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
});

async function listColumns() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log('Columns in users table:');
        console.table(res.rows);
    } catch (err) {
        console.error('Error listing columns:', err);
    } finally {
        await pool.end();
    }
}

listColumns();
