const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { rows } = await pool.query('SELECT x, y FROM business_processes LIMIT 5');
    console.log("Current coordinates in DB:");
    console.log(rows);
    pool.end();
}
run();
