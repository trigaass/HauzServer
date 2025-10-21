import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Testar conexão silenciosamente (só loga erro)
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erro ao conectar ao PostgreSQL:', err.message);
  } else {
    // Removido log de sucesso - conexão funciona silenciosamente
    release();
  }
});

const db = {
  query: (sql, params, callback) => {
    const sqlUpper = sql.trim().toUpperCase();
    const isInsert = sqlUpper.startsWith('INSERT');
    const isUpdate = sqlUpper.startsWith('UPDATE');
    const isDelete = sqlUpper.startsWith('DELETE');
    
    let paramIndex = 1;
    let convertedSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    
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
        // Mantém log de erro de query
        console.error('❌ Erro na query:', err.message);
        callback(err);
      });
  }
};

export default db;