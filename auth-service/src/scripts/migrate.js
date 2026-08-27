const db = require('../config/database');

async function columnExists(tableName, columnName) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );

  return rows[0].total > 0;
}

async function tableExists(tableName) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [tableName]
  );

  return rows[0].total > 0;
}

async function migrateDatabase() {
  const usuariosHasRole = await columnExists('usuarios', 'role');

  if (!usuariosHasRole) {
    await db.execute("ALTER TABLE usuarios ADD COLUMN role ENUM('usuario', 'admin') NOT NULL DEFAULT 'usuario'");
  }

  const resetTokensExists = await tableExists('reset_tokens');

  if (!resetTokensExists) {
    await db.execute(`
      CREATE TABLE reset_tokens (
        token VARCHAR(128) PRIMARY KEY,
        usuario_id INT NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expira_em TIMESTAMP NOT NULL,
        usado BOOLEAN NOT NULL DEFAULT FALSE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        INDEX idx_reset_tokens_usuario_id (usuario_id),
        INDEX idx_reset_tokens_expira_em (expira_em)
      )
    `);
  }

  console.log('Migração do auth-service concluída com sucesso.');
}

module.exports = migrateDatabase;