const pool = require('../config/database');

const migratePremium = async () => {
  await pool.query(
    'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS premium TINYINT(1) NOT NULL DEFAULT 0'
  );
  await pool.query(
    'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) NULL UNIQUE'
  );
  await pool.query(
    'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS premium_since DATETIME NULL'
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stripe_events (
      event_id VARCHAR(255) PRIMARY KEY,
      event_type VARCHAR(100) NOT NULL,
      received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

module.exports = migratePremium;