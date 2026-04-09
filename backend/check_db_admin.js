const { Pool } = require('pg');
require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({
    connectionString: "postgresql://postgres.cwmraliqxghpbxnilkff:Qhsid23sjd02KlOl23@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require",
    ssl: false
});

async function checkAdmin() {
    try {
        const res = await pool.query("SELECT id, name, email, role FROM users WHERE email = 'admin@bizpro.ai' OR role = 'admin'");
        console.log('ADMIN USERS FOUND:', res.rows);
    } catch (err) {
        console.error('ERROR QUERYING DB:', err);
    } finally {
        await pool.end();
    }
}

checkAdmin();
