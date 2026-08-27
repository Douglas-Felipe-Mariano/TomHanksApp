ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS role ENUM('usuario', 'admin') NOT NULL DEFAULT 'usuario';

CREATE TABLE IF NOT EXISTS reset_tokens (
  token VARCHAR(128) PRIMARY KEY,
  usuario_id INT NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expira_em TIMESTAMP NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_reset_tokens_usuario_id (usuario_id),
  INDEX idx_reset_tokens_expira_em (expira_em)
);