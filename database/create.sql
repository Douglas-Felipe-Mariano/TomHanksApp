CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  role ENUM('owner', 'reception', 'professional', 'admin', 'usuario') NOT NULL DEFAULT 'owner',
  senha_hash VARCHAR(255) NOT NULL,
  premium TINYINT(1) NOT NULL DEFAULT 0,
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  premium_since DATETIME NULL,
  premium_until DATETIME NULL,
  subscription_status VARCHAR(30) NOT NULL DEFAULT 'inactive',
  subscription_amount_cents INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clinics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_user_id INT NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  logo_url VARCHAR(500) NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'America/Sao_Paulo',
  workday_start CHAR(5) NOT NULL DEFAULT '09:00',
  workday_end CHAR(5) NOT NULL DEFAULT '17:00',
  slot_minutes SMALLINT NOT NULL DEFAULT 60,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_clinic_owner FOREIGN KEY (owner_user_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clinic_patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinic_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  marketing_consent TINYINT(1) NOT NULL DEFAULT 0,
  marketing_consent_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_patients_clinic_name (clinic_id, name),
  INDEX idx_patients_clinic_consent (clinic_id, marketing_consent),
  CONSTRAINT fk_patient_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clinic_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinic_id INT NOT NULL,
  user_id INT NOT NULL UNIQUE,
  role ENUM('reception', 'professional') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_clinic_member_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT fk_clinic_member_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY uq_clinic_member_role (clinic_id, user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clinic_appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinic_id INT NOT NULL,
  patient_id INT NOT NULL,
  professional_name VARCHAR(120) NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  status ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_appointments_clinic_start (clinic_id, start_at),
  INDEX idx_appointments_patient_status (patient_id, status, start_at),
  CONSTRAINT fk_appointment_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT fk_appointment_patient FOREIGN KEY (patient_id) REFERENCES clinic_patients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clinic_waitlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinic_id INT NOT NULL,
  patient_id INT NOT NULL,
  preferred_period ENUM('any', 'morning', 'afternoon', 'evening') NOT NULL DEFAULT 'any',
  preferred_weekday TINYINT NULL,
  status ENUM('waiting', 'contacted', 'booked', 'removed') NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_waitlist_clinic_status (clinic_id, status, created_at),
  CONSTRAINT fk_waitlist_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT fk_waitlist_patient FOREIGN KEY (patient_id) REFERENCES clinic_patients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clinic_marketing_sends (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  clinic_id INT NOT NULL,
  patient_id INT NOT NULL,
  campaign_key CHAR(36) NOT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_marketing_quota (clinic_id, sent_at),
  CONSTRAINT fk_marketing_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT fk_marketing_patient FOREIGN KEY (patient_id) REFERENCES clinic_patients(id) ON DELETE CASCADE
) ENGINE=InnoDB;
