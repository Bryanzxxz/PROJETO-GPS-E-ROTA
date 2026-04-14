require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Erro de conexao:', err.message);
  } else {
    console.log('Conexao com Supabase estabelecida com sucesso:', res.rows[0].now);
  }
  pool.end();
});
