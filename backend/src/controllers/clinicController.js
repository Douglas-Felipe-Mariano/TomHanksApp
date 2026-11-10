const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const pool = require('../config/database');
const { minioClient, bucketName } = require('../config/minio');
const logger = require('../utils/logger');

const PREMIUM_EMAIL_QUOTA = 200;
const ALLOWED_STATUSES = new Set(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']);
const uploadClinicLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp']);
    if (!allowed.has(extension) || !['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      return callback(new Error('Envie uma imagem PNG, JPG ou WebP de até 3 MB.'));
    }
    return callback(null, true);
  },
}).single('logo');

async function getClinicId(req) {
  if (req.clinicId) return req.clinicId;
  const [rows] = await pool.execute('SELECT id FROM clinics WHERE owner_user_id = ? LIMIT 1', [req.userId]);
  if (rows.length) return rows[0].id;

  const clinicName = String(req.user?.nome || 'Meu consultório').trim().slice(0, 120) || 'Meu consultório';
  await pool.execute(
    'INSERT INTO clinics (owner_user_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE owner_user_id = VALUES(owner_user_id)',
    [req.userId, clinicName]
  );
  const [created] = await pool.execute('SELECT id FROM clinics WHERE owner_user_id = ? LIMIT 1', [req.userId]);
  return created[0].id;
}

exports.listClinicMembers = async (req, res) => {
  try {
    const [owners] = await pool.execute(
      `SELECT u.id, u.nome AS name, u.email, 'owner' AS role
       FROM clinics c JOIN usuarios u ON u.id = c.owner_user_id WHERE c.id = ?`,
      [req.clinicId]
    );
    const [members] = await pool.execute(
      `SELECT u.id, u.nome AS name, u.email, m.role
       FROM clinic_members m JOIN usuarios u ON u.id = m.user_id
       WHERE m.clinic_id = ? ORDER BY u.nome`,
      [req.clinicId]
    );
    return res.json([...owners, ...members]);
  } catch (error) {
    return sendError(res, error, 'Não foi possível carregar a equipe do consultório.');
  }
};

exports.addClinicMember = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const role = String(req.body.role || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['reception', 'professional'].includes(role)) {
    return res.status(400).json({ error: 'Informe um e-mail de conta existente e o papel recepção ou profissional.' });
  }
  try {
    const [users] = await pool.execute('SELECT id, role FROM usuarios WHERE email = ? LIMIT 1', [email]);
    if (!users.length) return res.status(404).json({ error: 'Crie primeiro uma conta AgendaLivre para este e-mail.' });
    const memberId = Number(users[0].id);
    if (users[0].role === 'admin') return res.status(409).json({ error: 'Contas administradoras da plataforma não podem ser membros de consultório.' });
    if (memberId === Number(req.userId)) return res.status(400).json({ error: 'O proprietário já faz parte da equipe.' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [owned] = await connection.execute('SELECT id FROM clinics WHERE owner_user_id = ? FOR UPDATE', [memberId]);
      if (owned.length) {
        const ownedClinicId = owned[0].id;
        const [[usage]] = await connection.execute(
          `SELECT (SELECT COUNT(*) FROM clinic_patients WHERE clinic_id = ?) AS patients,
                  (SELECT COUNT(*) FROM clinic_members WHERE clinic_id = ?) AS members`,
          [ownedClinicId, ownedClinicId]
        );
        if (Number(usage.patients) || Number(usage.members)) {
          await connection.rollback();
          return res.status(409).json({ error: 'Esta conta já possui um consultório com dados e não pode ser movida para outra equipe.' });
        }
        await connection.execute('DELETE FROM clinics WHERE id = ?', [ownedClinicId]);
      }
      const [existingMembership] = await connection.execute(
        'SELECT clinic_id FROM clinic_members WHERE user_id = ? FOR UPDATE', [memberId]
      );
      if (existingMembership.length && Number(existingMembership[0].clinic_id) !== Number(req.clinicId)) {
        await connection.rollback();
        return res.status(409).json({ error: 'Esta conta já está vinculada a outro consultório.' });
      }
      await connection.execute(
        `INSERT INTO clinic_members (clinic_id, user_id, role) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE role = VALUES(role)`,
        [req.clinicId, memberId, role]
      );
      await connection.execute('UPDATE usuarios SET role = ? WHERE id = ?', [role, memberId]);
      await connection.commit();
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }
    logger.logEvent(req.userId, `clinic_member_${role}_added`);
    return res.status(201).json({ message: 'Pessoa vinculada à equipe.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Esta conta já está vinculada a um consultório.' });
    }
    return sendError(res, error, 'Não foi possível adicionar a pessoa à equipe.');
  }
};

exports.removeClinicMember = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      'DELETE FROM clinic_members WHERE clinic_id = ? AND user_id = ?',
      [req.clinicId, req.params.userId]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ error: 'Membro não encontrado.' });
    }
    await connection.execute(
      "UPDATE usuarios SET role = 'owner' WHERE id = ? AND role IN ('reception', 'professional')",
      [req.params.userId]
    );
    await connection.commit();
    logger.logEvent(req.userId, 'clinic_member_removed');
    return res.json({ message: 'Pessoa removida da equipe.' });
  } catch (error) {
    await connection.rollback();
    return sendError(res, error, 'Não foi possível remover a pessoa da equipe.');
  } finally {
    connection.release();
  }
};

exports.uploadClinicLogo = (req, res) => uploadClinicLogo(req, res, async (uploadError) => {
  if (uploadError) return res.status(400).json({ error: uploadError.message });
  if (!req.file) return res.status(400).json({ error: 'Selecione uma imagem para o logo.' });
  const extension = path.extname(req.file.originalname).toLowerCase();
  const objectName = `clinics/${req.clinicId}/logo_${Date.now()}${extension}`;
  try {
    await minioClient.putObject(bucketName, objectName, req.file.buffer, req.file.size, {
      'Content-Type': req.file.mimetype,
    });
    const publicEndpoint = (process.env.MINIO_PUBLIC_URL || 'http://localhost:9000').replace(/\/$/, '');
    const logoUrl = `${publicEndpoint}/${bucketName}/${objectName}`;
    await pool.execute('UPDATE clinics SET logo_url = ? WHERE id = ?', [logoUrl, req.clinicId]);
    logger.logEvent(req.userId, 'clinic_logo_uploaded');
    return res.json({ logo_url: logoUrl });
  } catch (error) {
    return sendError(res, error, 'Não foi possível salvar o logo no armazenamento.');
  }
});

async function isPremium(userId) {
  const [rows] = await pool.execute('SELECT premium FROM usuarios WHERE id = ? LIMIT 1', [userId]);
  return rows.length > 0 && Boolean(Number(rows[0].premium));
}

async function premiumOnly(req, res) {
  if (await isPremium(req.clinicOwnerId || req.userId)) return true;
  res.status(403).json({ error: 'Este recurso está disponível no Plano Premium.' });
  return false;
}

function sendError(res, error, message = 'Não foi possível concluir a operação.') {
  console.error(message, error.message);
  return res.status(500).json({ error: message });
}

function parseUtcDateTime(value) {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function htmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function unsubscribeSignature(clinicId, patientId, secret) {
  return crypto.createHmac('sha256', secret).update(`${clinicId}:${patientId}`).digest('hex');
}

exports.getDashboard = async (req, res) => {
  try {
    const clinicId = await getClinicId(req);
    const from = parseUtcDateTime(req.query.from);
    const to = parseUtcDateTime(req.query.to);
    const [clinicRows] = await pool.execute(
      'SELECT id, name, logo_url, timezone, workday_start, workday_end, slot_minutes FROM clinics WHERE id = ?',
      [clinicId]
    );
    const [[patientCount]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM clinic_patients WHERE clinic_id = ?', [clinicId]
    );
    const [[monthlyAppointments]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM clinic_appointments
       WHERE clinic_id = ? AND created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01 00:00:00')`,
      [clinicId]
    );
    const [[upcomingCount]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM clinic_appointments
       WHERE clinic_id = ? AND start_at >= UTC_TIMESTAMP() AND status IN ('scheduled', 'confirmed')`,
      [clinicId]
    );
    let todayCount = 0;
    if (from && to) {
      const [[today]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM clinic_appointments
         WHERE clinic_id = ? AND start_at >= ? AND start_at < ? AND status NOT IN ('cancelled', 'no_show')`,
        [clinicId, from, to]
      );
      todayCount = Number(today.total);
    }
    const professionalRestriction = req.clinicRole === 'professional' ? ' AND a.professional_name = ?' : '';
    const parameters = req.clinicRole === 'professional'
      ? [clinicId, req.user?.nome || '']
      : [clinicId];
    const [appointments] = await pool.execute(
      `SELECT a.id, a.patient_id, p.name AS patient_name, p.phone AS patient_phone,
              a.professional_name, a.start_at, a.end_at, a.status
       FROM clinic_appointments a
       JOIN clinic_patients p ON p.id = a.patient_id AND p.clinic_id = a.clinic_id
       WHERE a.clinic_id = ?${professionalRestriction} AND a.start_at >= UTC_TIMESTAMP()
         AND a.status IN ('scheduled', 'confirmed')
       ORDER BY a.start_at ASC LIMIT 8`,
      parameters
    );
    const premium = await isPremium(req.clinicOwnerId || req.userId);
    return res.json({
      clinic: clinicRows[0],
      premium,
      clinicRole: req.clinicRole || 'owner',
      stats: {
        patients: Number(patientCount.total), upcoming: Number(upcomingCount.total), today: todayCount,
        appointmentsCreatedThisMonth: Number(monthlyAppointments.total),
      },
      plan: { name: premium ? 'pro' : 'free', freeAppointmentLimit: 3 },
      appointments,
    });
  } catch (error) {
    return sendError(res, error, 'Não foi possível carregar o painel do consultório.');
  }
};

exports.updateClinicSettings = async (req, res) => {
  const clinicName = String(req.body.name || '').trim();
  const start = String(req.body.workday_start || '');
  const end = String(req.body.workday_end || '');
  const slot = Number(req.body.slot_minutes);
  if (!clinicName || clinicName.length > 120 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start >= end
      || ![15, 30, 45, 60, 90, 120].includes(slot)) {
    return res.status(400).json({ error: 'Confira o nome, o horário de funcionamento e a duração dos horários.' });
  }
  try {
    const clinicId = await getClinicId(req);
    await pool.execute(
      'UPDATE clinics SET name = ?, workday_start = ?, workday_end = ?, slot_minutes = ? WHERE id = ?',
      [clinicName, start, end, slot, clinicId]
    );
    logger.logEvent(req.userId, 'clinic_settings_updated');
    return res.json({ message: 'Configurações salvas.' });
  } catch (error) {
    return sendError(res, error, 'Não foi possível salvar as configurações.');
  }
};

exports.listPatients = async (req, res) => {
  try {
    const clinicId = await getClinicId(req);
    const search = `%${String(req.query.search || '').trim().slice(0, 80)}%`;
    const professionalAppointmentRestriction = req.clinicRole === 'professional'
      ? ' AND a.professional_name = ?'
      : '';
    const professionalPatientRestriction = req.clinicRole === 'professional'
      ? ` AND EXISTS (
          SELECT 1 FROM clinic_appointments own_a
          WHERE own_a.clinic_id = p.clinic_id AND own_a.patient_id = p.id
            AND own_a.professional_name = ?
        )`
      : '';
    const parameters = req.clinicRole === 'professional'
      ? [req.user?.nome || '', clinicId, req.user?.nome || '', search, search, search]
      : [clinicId, search, search, search];
    const [patients] = await pool.execute(
      `SELECT p.id, p.name, p.email, p.phone, p.marketing_consent, p.created_at,
              MAX(CASE WHEN a.status = 'completed' THEN a.start_at END) AS last_visit,
              MAX(CASE WHEN a.status IN ('scheduled', 'confirmed') AND a.start_at >= UTC_TIMESTAMP() THEN a.start_at END) AS next_visit
       FROM clinic_patients p
      LEFT JOIN clinic_appointments a ON a.patient_id = p.id AND a.clinic_id = p.clinic_id${professionalAppointmentRestriction}
      WHERE p.clinic_id = ?${professionalPatientRestriction}
         AND (p.name LIKE ? OR COALESCE(p.email, '') LIKE ? OR COALESCE(p.phone, '') LIKE ?)
       GROUP BY p.id ORDER BY p.name ASC LIMIT 200`,
      parameters
    );
    return res.json(patients);
  } catch (error) {
    return sendError(res, error, 'Não foi possível carregar os pacientes.');
  }
};

exports.createPatient = async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const consent = req.body.marketing_consent === true;
  if (!name || name.length > 120 || email.length > 190 || phone.length > 40
      || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return res.status(400).json({ error: 'Informe um nome válido e confira o e-mail e telefone.' });
  }
  try {
    const clinicId = await getClinicId(req);
    const [result] = await pool.execute(
      `INSERT INTO clinic_patients (clinic_id, name, email, phone, marketing_consent, marketing_consent_at)
       VALUES (?, ?, ?, ?, ?, ?)` ,
      [clinicId, name, email || null, phone || null, consent ? 1 : 0, consent ? new Date() : null]
    );
    logger.logEvent(req.userId, 'clinic_patient_created');
    return res.status(201).json({ id: result.insertId, name, email, phone, marketing_consent: consent });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Este paciente já está cadastrado.' });
    return sendError(res, error, 'Não foi possível cadastrar o paciente.');
  }
};

exports.updatePatientConsent = async (req, res) => {
  if (typeof req.body.marketing_consent !== 'boolean') {
    return res.status(400).json({ error: 'Informe se o paciente autorizou comunicações.' });
  }
  try {
    const clinicId = await getClinicId(req);
    const [result] = await pool.execute(
      `UPDATE clinic_patients
       SET marketing_consent = ?, marketing_consent_at = IF(? = 1, COALESCE(marketing_consent_at, NOW()), NULL)
       WHERE id = ? AND clinic_id = ?`,
      [req.body.marketing_consent ? 1 : 0, req.body.marketing_consent ? 1 : 0, req.params.id, clinicId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Paciente não encontrado.' });
    logger.logEvent(req.userId, 'clinic_patient_consent_updated');
    return res.json({ message: 'Preferência de comunicação atualizada.' });
  } catch (error) {
    return sendError(res, error, 'Não foi possível atualizar a preferência.');
  }
};

exports.listAppointments = async (req, res) => {
  try {
    const clinicId = await getClinicId(req);
    const professionalRestriction = req.clinicRole === 'professional' ? ' AND a.professional_name = ?' : '';
    const parameters = req.clinicRole === 'professional'
      ? [clinicId, req.user?.nome || '']
      : [clinicId];
    const [appointments] = await pool.execute(
      `SELECT a.id, a.patient_id, p.name AS patient_name, p.email AS patient_email,
              p.phone AS patient_phone, a.professional_name, a.start_at, a.end_at, a.status
       FROM clinic_appointments a
       JOIN clinic_patients p ON p.id = a.patient_id AND p.clinic_id = a.clinic_id
       WHERE a.clinic_id = ?${professionalRestriction} ORDER BY a.start_at DESC LIMIT 300`,
      parameters
    );
    return res.json(appointments);
  } catch (error) {
    return sendError(res, error, 'Não foi possível carregar a agenda.');
  }
};

exports.getAppointment = async (req, res) => {
  try {
    const clinicId = await getClinicId(req);
    const professionalRestriction = req.clinicRole === 'professional' ? ' AND a.professional_name = ?' : '';
    const parameters = req.clinicRole === 'professional'
      ? [req.params.id, clinicId, req.user?.nome || '']
      : [req.params.id, clinicId];
    const [appointments] = await pool.execute(
      `SELECT a.id, a.patient_id, p.name AS patient_name, a.professional_name,
              a.start_at, a.end_at, a.status
       FROM clinic_appointments a
       JOIN clinic_patients p ON p.id = a.patient_id AND p.clinic_id = a.clinic_id
       WHERE a.id = ? AND a.clinic_id = ?${professionalRestriction} LIMIT 1`,
      parameters
    );
    if (!appointments.length) return res.status(404).json({ error: 'Atendimento não encontrado.' });
    return res.json(appointments[0]);
  } catch (error) {
    return sendError(res, error, 'Não foi possível carregar o atendimento.');
  }
};

exports.updateAppointment = async (req, res) => {
  const patientId = Number(req.body.patient_id);
  const startAt = parseUtcDateTime(req.body.start_at);
  const duration = Number(req.body.duration_minutes || 60);
  const requestedProfessional = String(req.body.professional_name || req.user?.nome || '').trim();
  const professional = String(req.clinicRole === 'professional' ? req.user?.nome : requestedProfessional)
    .trim().slice(0, 120);
  if (!Number.isSafeInteger(patientId) || patientId < 1 || !professional || !startAt
      || ![15, 30, 45, 60, 90, 120].includes(duration)) {
    return res.status(400).json({ error: 'Confira paciente, profissional, data e duração.' });
  }
  const endAt = new Date(new Date(`${startAt.replace(' ', 'T')}Z`).getTime() + duration * 60_000)
    .toISOString().slice(0, 19).replace('T', ' ');
  const connection = await pool.getConnection();
  try {
    const clinicId = await getClinicId(req);
    await connection.beginTransaction();
    await connection.execute('SELECT id FROM clinics WHERE id = ? FOR UPDATE', [clinicId]);
    const professionalRestriction = req.clinicRole === 'professional' ? ' AND professional_name = ?' : '';
    const currentParameters = req.clinicRole === 'professional'
      ? [req.params.id, clinicId, req.user?.nome || '']
      : [req.params.id, clinicId];
    const [current] = await connection.execute(
      `SELECT id, status FROM clinic_appointments WHERE id = ? AND clinic_id = ?${professionalRestriction} FOR UPDATE`,
      currentParameters
    );
    if (!current.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Atendimento não encontrado.' });
    }
    if (['completed', 'no_show'].includes(current[0].status)) {
      await connection.rollback();
      return res.status(409).json({ error: 'Atendimentos concluídos ou com falta não podem ser remarcados.' });
    }
    const [patients] = await connection.execute(
      'SELECT id FROM clinic_patients WHERE id = ? AND clinic_id = ?', [patientId, clinicId]
    );
    if (!patients.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Paciente não encontrado neste consultório.' });
    }
    const [conflicts] = await connection.execute(
      `SELECT id FROM clinic_appointments
       WHERE clinic_id = ? AND professional_name = ? AND id <> ? AND status IN ('scheduled', 'confirmed')
         AND start_at < ? AND end_at > ? LIMIT 1`,
      [clinicId, professional, req.params.id, endAt, startAt]
    );
    if (conflicts.length) {
      await connection.rollback();
      return res.status(409).json({ error: 'Esse profissional já possui um atendimento nesse horário.' });
    }
    await connection.execute(
      `UPDATE clinic_appointments SET patient_id = ?, professional_name = ?, start_at = ?, end_at = ?,
        status = IF(status = 'cancelled', 'scheduled', status)
       WHERE id = ? AND clinic_id = ?`,
      [patientId, professional, startAt, endAt, req.params.id, clinicId]
    );
    await connection.commit();
    logger.logEvent(req.userId, 'clinic_appointment_rescheduled');
    return res.json({ message: 'Atendimento atualizado.' });
  } catch (error) {
    await connection.rollback();
    return sendError(res, error, 'Não foi possível atualizar o atendimento.');
  } finally {
    connection.release();
  }
};

exports.deleteAppointment = async (req, res) => {
  try {
    const clinicId = await getClinicId(req);
    const professionalRestriction = req.clinicRole === 'professional' ? ' AND professional_name = ?' : '';
    const parameters = req.clinicRole === 'professional'
      ? [req.params.id, clinicId, req.user?.nome || '']
      : [req.params.id, clinicId];
    const [result] = await pool.execute(
      `UPDATE clinic_appointments SET status = 'cancelled'
      WHERE id = ? AND clinic_id = ?${professionalRestriction} AND status IN ('scheduled', 'confirmed')`,
      parameters
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Atendimento não encontrado ou já cancelado.' });
    logger.logEvent(req.userId, 'clinic_appointment_cancelled');
    return res.json({ message: 'Atendimento cancelado; o histórico foi preservado.' });
  } catch (error) {
    return sendError(res, error, 'Não foi possível cancelar o atendimento.');
  }
};

exports.createAppointment = async (req, res) => {
  const patientId = Number(req.body.patient_id);
  const requestedProfessional = String(req.body.professional_name || req.user?.nome || '').trim();
  const professional = String(req.clinicRole === 'professional' ? req.user?.nome : requestedProfessional)
    .trim().slice(0, 120);
  const startAt = parseUtcDateTime(req.body.start_at);
  const duration = Number(req.body.duration_minutes || 60);
  if (!Number.isSafeInteger(patientId) || patientId < 1 || !professional || !startAt
      || ![15, 30, 45, 60, 90, 120].includes(duration)) {
    return res.status(400).json({ error: 'Confira paciente, profissional, data e duração.' });
  }
  const startDate = new Date(`${startAt.replace(' ', 'T')}Z`);
  const endDate = new Date(startDate.getTime() + duration * 60_000);
  const endAt = endDate.toISOString().slice(0, 19).replace('T', ' ');
  const connection = await pool.getConnection();
  try {
    const clinicId = await getClinicId(req);
    await connection.beginTransaction();
    await connection.execute('SELECT id FROM clinics WHERE id = ? FOR UPDATE', [clinicId]);
    const [patientRows] = await connection.execute(
      'SELECT id FROM clinic_patients WHERE id = ? AND clinic_id = ?', [patientId, clinicId]
    );
    if (!patientRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Paciente não encontrado neste consultório.' });
    }
    const [owners] = await connection.execute(
      'SELECT premium FROM usuarios WHERE id = ? FOR UPDATE', [req.clinicOwnerId || req.userId]
    );
    if (!Boolean(Number(owners[0]?.premium))) {
      const [[usage]] = await connection.execute(
        `SELECT COUNT(*) AS total FROM clinic_appointments
         WHERE clinic_id = ? AND created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01 00:00:00')`,
        [clinicId]
      );
      const current = Number(usage.total);
      if (current >= 3) {
        await connection.rollback();
        logger.logEvent(req.userId, 'limite_free_agendamentos_atingido');
        return res.status(403).json({
          error: 'O plano Free permite até 3 novos agendamentos por mês. Assine o Pro para remover esse limite.',
          code: 'PLAN_LIMIT_REACHED', limit: 3, current,
        });
      }
    }
    const [conflicts] = await connection.execute(
      `SELECT id FROM clinic_appointments
       WHERE clinic_id = ? AND professional_name = ? AND status IN ('scheduled', 'confirmed')
         AND start_at < ? AND end_at > ? LIMIT 1`,
      [clinicId, professional, endAt, startAt]
    );
    if (conflicts.length) {
      await connection.rollback();
      return res.status(409).json({ error: 'Esse profissional já possui um atendimento nesse horário.' });
    }
    const [result] = await connection.execute(
      `INSERT INTO clinic_appointments (clinic_id, patient_id, professional_name, start_at, end_at)
       VALUES (?, ?, ?, ?, ?)`,
      [clinicId, patientId, professional, startAt, endAt]
    );
    await connection.commit();
    logger.logEvent(req.userId, 'clinic_appointment_created');
    return res.status(201).json({ id: result.insertId, message: 'Horário reservado.' });
  } catch (error) {
    await connection.rollback();
    return sendError(res, error, 'Não foi possível agendar o atendimento.');
  } finally {
    connection.release();
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  const status = String(req.body.status || '');
  if (!ALLOWED_STATUSES.has(status)) return res.status(400).json({ error: 'Status inválido.' });
  try {
    const clinicId = await getClinicId(req);
    const professionalRestriction = req.clinicRole === 'professional' ? ' AND professional_name = ?' : '';
    const parameters = req.clinicRole === 'professional'
      ? [status, req.params.id, clinicId, req.user?.nome || '']
      : [status, req.params.id, clinicId];
    const [result] = await pool.execute(
      `UPDATE clinic_appointments SET status = ? WHERE id = ? AND clinic_id = ?${professionalRestriction}`,
      parameters
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Atendimento não encontrado.' });
    logger.logEvent(req.userId, `clinic_appointment_${status}`);
    let waitlistSuggestions = [];
    if (status === 'cancelled' && await isPremium(req.clinicOwnerId || req.userId)) {
      const [cancelledAppointments] = await pool.execute(
        'SELECT start_at FROM clinic_appointments WHERE id = ? AND clinic_id = ? LIMIT 1',
        [req.params.id, clinicId]
      );
      const cancelledAt = cancelledAppointments[0]?.start_at;
      if (!cancelledAt) return res.json({ message: 'Status atualizado.', waitlistSuggestions });
      const [suggestions] = await pool.execute(
        `SELECT w.id AS waitlist_id, p.id AS patient_id, p.name, p.email, p.phone,
                w.preferred_period, w.preferred_weekday
         FROM clinic_waitlist w
         JOIN clinic_patients p ON p.id = w.patient_id AND p.clinic_id = w.clinic_id
         WHERE w.clinic_id = ? AND w.status = 'waiting'
           AND (w.preferred_period = 'any'
             OR (w.preferred_period = 'morning' AND HOUR(?) < 12)
             OR (w.preferred_period = 'afternoon' AND HOUR(?) >= 12 AND HOUR(?) < 17)
             OR (w.preferred_period = 'evening' AND HOUR(?) >= 17))
           AND (w.preferred_weekday IS NULL OR w.preferred_weekday = DAYOFWEEK(?) - 1)
         ORDER BY w.created_at ASC LIMIT 10`,
        [clinicId, cancelledAt, cancelledAt, cancelledAt, cancelledAt, cancelledAt]
      );
      waitlistSuggestions = suggestions;
    }
    return res.json({ message: 'Status atualizado.', waitlistSuggestions });
  } catch (error) {
    return sendError(res, error, 'Não foi possível atualizar o atendimento.');
  }
};

exports.listWaitlist = async (req, res) => {
  try {
    const clinicId = await getClinicId(req);
    const [entries] = await pool.execute(
      `SELECT w.id, w.patient_id, p.name AS patient_name, p.email, p.phone,
              w.preferred_period, w.preferred_weekday, w.status, w.created_at
       FROM clinic_waitlist w
       JOIN clinic_patients p ON p.id = w.patient_id AND p.clinic_id = w.clinic_id
       WHERE w.clinic_id = ? AND w.status IN ('waiting', 'contacted')
       ORDER BY w.created_at ASC`,
      [clinicId]
    );
    return res.json(entries);
  } catch (error) {
    return sendError(res, error, 'Não foi possível carregar a lista de espera.');
  }
};

exports.addToWaitlist = async (req, res) => {
  const patientId = Number(req.body.patient_id);
  const period = String(req.body.preferred_period || 'any');
  const weekday = req.body.preferred_weekday === '' || req.body.preferred_weekday == null
    ? null : Number(req.body.preferred_weekday);
  if (!Number.isSafeInteger(patientId) || patientId < 1
      || !['any', 'morning', 'afternoon', 'evening'].includes(period)
      || (weekday !== null && (!Number.isInteger(weekday) || weekday < 0 || weekday > 6))) {
    return res.status(400).json({ error: 'Confira o paciente e as preferências de horário.' });
  }
  try {
    const clinicId = await getClinicId(req);
    const [patients] = await pool.execute(
      'SELECT id FROM clinic_patients WHERE id = ? AND clinic_id = ?', [patientId, clinicId]
    );
    if (!patients.length) return res.status(404).json({ error: 'Paciente não encontrado.' });
    const [result] = await pool.execute(
      `INSERT INTO clinic_waitlist (clinic_id, patient_id, preferred_period, preferred_weekday)
       VALUES (?, ?, ?, ?)`, [clinicId, patientId, period, weekday]
    );
    logger.logEvent(req.userId, 'clinic_waitlist_added');
    return res.status(201).json({ id: result.insertId, message: 'Paciente adicionado à lista de espera.' });
  } catch (error) {
    return sendError(res, error, 'Não foi possível adicionar à lista de espera.');
  }
};

exports.updateWaitlistStatus = async (req, res) => {
  const status = String(req.body.status || '');
  if (!['waiting', 'contacted', 'booked', 'removed'].includes(status)) {
    return res.status(400).json({ error: 'Status da lista de espera inválido.' });
  }
  try {
    const clinicId = await getClinicId(req);
    const [result] = await pool.execute(
      'UPDATE clinic_waitlist SET status = ? WHERE id = ? AND clinic_id = ?',
      [status, req.params.id, clinicId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Entrada não encontrada.' });
    logger.logEvent(req.userId, `clinic_waitlist_${status}`);
    return res.json({ message: 'Lista de espera atualizada.' });
  } catch (error) {
    return sendError(res, error, 'Não foi possível atualizar a lista de espera.');
  }
};

exports.listReactivationCandidates = async (req, res) => {
  if (!await premiumOnly(req, res)) return;
  const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 90, 30), 365);
  try {
    const clinicId = await getClinicId(req);
    const [patients] = await pool.execute(
      `SELECT p.id, p.name, p.email, p.marketing_consent,
              MAX(CASE WHEN a.status = 'completed' THEN a.start_at END) AS last_visit
       FROM clinic_patients p
       JOIN clinic_appointments a ON a.patient_id = p.id AND a.clinic_id = p.clinic_id
       WHERE p.clinic_id = ?
       GROUP BY p.id
       HAVING last_visit IS NOT NULL AND last_visit < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
          AND NOT EXISTS (
            SELECT 1 FROM clinic_appointments next_a
            WHERE next_a.patient_id = p.id AND next_a.clinic_id = p.clinic_id
              AND next_a.status IN ('scheduled', 'confirmed') AND next_a.start_at >= UTC_TIMESTAMP()
          )
       ORDER BY last_visit ASC LIMIT 200`,
      [clinicId, days]
    );
    return res.json({ days, patients });
  } catch (error) {
    return sendError(res, error, 'Não foi possível buscar sugestões de retorno.');
  }
};

exports.sendCampaign = async (req, res) => {
  if (!await premiumOnly(req, res)) return;
  const subject = String(req.body.subject || '').trim();
  const message = String(req.body.message || '').trim();
  const patientIds = [...new Set((Array.isArray(req.body.patient_ids) ? req.body.patient_ids : [])
    .map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, PREMIUM_EMAIL_QUOTA);
  if (!subject || subject.length > 120 || /[\r\n]/.test(subject)
      || !message || message.length > 2000 || !patientIds.length) {
    return res.status(400).json({ error: 'Informe assunto, mensagem e ao menos um destinatário.' });
  }
  if (!process.env.SMTP_HOST || !process.env.EMAIL_FROM || !process.env.MARKETING_UNSUBSCRIBE_SECRET) {
    return res.status(503).json({ error: 'Configure o SMTP e o segredo de descadastro para enviar campanhas.' });
  }
  try {
    const clinicId = await getClinicId(req);
    const [[usage]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM clinic_marketing_sends
       WHERE clinic_id = ? AND sent_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01 00:00:00')`, [clinicId]
    );
    const remaining = Math.max(0, PREMIUM_EMAIL_QUOTA - Number(usage.total));
    if (patientIds.length > remaining) {
      return res.status(429).json({ error: `Limite mensal: restam ${remaining} envios no plano Premium.` });
    }
    const placeholders = patientIds.map(() => '?').join(',');
    const [recipients] = await pool.execute(
      `SELECT id, name, email FROM clinic_patients
       WHERE clinic_id = ? AND marketing_consent = 1 AND email IS NOT NULL AND id IN (${placeholders})`,
      [clinicId, ...patientIds]
    );
    if (!recipients.length) return res.status(400).json({ error: 'Nenhum destinatário selecionado autorizou receber mensagens.' });

    const appUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
        || Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    const campaignKey = crypto.randomUUID();
    let sent = 0;
    for (const recipient of recipients) {
      const signature = unsubscribeSignature(clinicId, recipient.id, process.env.MARKETING_UNSUBSCRIBE_SECRET);
      const unsubscribeUrl = `${appUrl}/api/public/unsubscribe?clinicId=${clinicId}&patientId=${recipient.id}&signature=${signature}`;
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: recipient.email,
          subject,
          text: `${message}\n\nPara deixar de receber comunicações, acesse: ${unsubscribeUrl}`,
          html: `<p>${htmlEscape(message).replace(/\n/g, '<br>')}</p><hr><p style="font-size:12px;color:#667085">Você recebe esta mensagem porque autorizou comunicações deste consultório. <a href="${unsubscribeUrl}">Cancelar recebimento</a>.</p>`,
          headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        });
        await pool.execute(
          'INSERT INTO clinic_marketing_sends (clinic_id, patient_id, campaign_key) VALUES (?, ?, ?)',
          [clinicId, recipient.id, campaignKey]
        );
        sent += 1;
      } catch (mailError) {
        console.error('Falha ao enviar comunicação para paciente:', mailError.message);
      }
    }
    logger.logEvent(req.userId, 'clinic_marketing_campaign_sent');
    return res.json({ sent, quota: PREMIUM_EMAIL_QUOTA, remaining: Math.max(0, remaining - sent) });
  } catch (error) {
    return sendError(res, error, 'Não foi possível enviar a campanha.');
  }
};

exports.unsubscribe = async (req, res) => {
  const clinicId = Number(req.query.clinicId);
  const patientId = Number(req.query.patientId);
  const signature = String(req.query.signature || '');
  const secret = process.env.MARKETING_UNSUBSCRIBE_SECRET;
  if (!secret || !Number.isSafeInteger(clinicId) || !Number.isSafeInteger(patientId) || !/^[a-f0-9]{64}$/i.test(signature)) {
    return res.status(400).send('Link de descadastro inválido.');
  }
  const expected = unsubscribeSignature(clinicId, patientId, secret);
  const supplied = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (supplied.length !== expectedBuffer.length || !crypto.timingSafeEqual(supplied, expectedBuffer)) {
    return res.status(400).send('Link de descadastro inválido.');
  }
  if (req.method === 'GET') {
    const action = `/api/public/unsubscribe?clinicId=${clinicId}&patientId=${patientId}&signature=${expected}`;
    return res.status(200).type('html').send(
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preferência de comunicação</title><body style="font:16px sans-serif;max-width:560px;margin:12vh auto;padding:24px;color:#303241"><h1>Cancelar recebimento de mensagens?</h1><p>Confirme para não receber novas comunicações administrativas deste consultório.</p><form method="post" action="${action}"><button style="padding:12px 18px;border:0;border-radius:8px;background:#7060d7;color:#fff;font-weight:700">Confirmar descadastro</button></form></body></html>`
    );
  }
  try {
    await pool.execute(
      'UPDATE clinic_patients SET marketing_consent = 0, marketing_consent_at = NULL WHERE id = ? AND clinic_id = ?',
      [patientId, clinicId]
    );
    return res.status(200).send('Preferência atualizada. Você não receberá novas comunicações deste consultório.');
  } catch (error) {
    return sendError(res, error, 'Não foi possível processar o descadastro.');
  }
};
