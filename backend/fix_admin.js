const pg = require('pg');
const { Pool } = pg;
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: "postgresql://postgres.cwmraliqxghpbxnilkff:Qhsid23sjd02KlOl23@aws-1-eu-north-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
});

async function fixAdmin() {
    try {
        console.log('Updating admin user...');
        await pool.query(`
            UPDATE users 
            SET role = 'admin', 
                full_name = 'Главный Администратор', 
                email = 'admin@bizpro.ai' 
            WHERE name = 'admin'
        `);
        console.log('Admin user updated successfully.');
    } catch (err) {
        console.error('Error updating admin:', err);
    } finally {
        await pool.end();
    }
}

fixAdmin();
