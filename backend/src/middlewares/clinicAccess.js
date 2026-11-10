const pool = require('../config/database');
const logger = require('../utils/logger');

module.exports = async (req, res, next) => {
  try {
    const [ownedClinics] = await pool.execute(
      'SELECT id FROM clinics WHERE owner_user_id = ? LIMIT 1', [req.userId]
    );
    if (ownedClinics.length) {
      req.clinicId = ownedClinics[0].id;
      req.clinicOwnerId = Number(req.userId);
      req.clinicRole = 'owner';
      return next();
    }

    const [memberships] = await pool.execute(
      `SELECT c.id AS clinic_id, c.owner_user_id, m.role
       FROM clinic_members m JOIN clinics c ON c.id = m.clinic_id
       WHERE m.user_id = ? LIMIT 1`,
      [req.userId]
    );
    if (memberships.length) {
      req.clinicId = memberships[0].clinic_id;
      req.clinicOwnerId = Number(memberships[0].owner_user_id);
      req.clinicRole = memberships[0].role;
      return next();
    }

    if (!['owner', 'usuario'].includes(req.userRole)) {
      logger.logEvent(req.userId, 'tentativa_negada_403_sem_vinculo_consultorio');
      return res.status(403).json({ error: 'Sua conta ainda não está vinculada a um consultório.' });
    }

    const clinicName = String(req.user?.nome || 'Meu consultório').trim().slice(0, 120) || 'Meu consultório';
    await pool.execute(
      'INSERT INTO clinics (owner_user_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE owner_user_id = VALUES(owner_user_id)',
      [req.userId, clinicName]
    );
    const [createdClinics] = await pool.execute(
      'SELECT id FROM clinics WHERE owner_user_id = ? LIMIT 1', [req.userId]
    );
    req.clinicId = createdClinics[0].id;
    req.clinicOwnerId = Number(req.userId);
    req.clinicRole = 'owner';
    return next();
  } catch (error) {
    console.error('Erro ao resolver o consultório da sessão:', error.message);
    return res.status(500).json({ error: 'Não foi possível validar o acesso ao consultório.' });
  }
};
