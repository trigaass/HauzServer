import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Cria o pool de conexões usando a connection string do Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Testar conexão
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erro ao conectar ao PostgreSQL (Neon):', err.stack);
  } else {
    console.log('✅ Conectado ao PostgreSQL (Neon) com sucesso!');
    release();
  }
});

// Wrapper para manter compatibilidade com estilo MySQL-like
const db = {
  query: (sql, params, callback) => {
    const sqlUpper = sql.trim().toUpperCase();
    const isInsert = sqlUpper.startsWith('INSERT');
    const isUpdate = sqlUpper.startsWith('UPDATE');
    const isDelete = sqlUpper.startsWith('DELETE');
    
    // Converter placeholders ? para $1, $2, etc.
    let paramIndex = 1;
    let convertedSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    
    // Adicionar RETURNING id para INSERTs
    if (isInsert && !sqlUpper.includes('RETURNING')) {
      convertedSql += ' RETURNING id';
    }
    
    pool.query(convertedSql, params)
      .then(result => {
        if (isInsert) {
          callback(null, {
            insertId: result.rows[0]?.id,
            affectedRows: result.rowCount
          });
        } else if (isUpdate || isDelete) {
          callback(null, {
            affectedRows: result.rowCount
          });
        } else {
          callback(null, result.rows);
        }
      })
      .catch(err => {
        callback(err);
      });
  }
};

export default db;