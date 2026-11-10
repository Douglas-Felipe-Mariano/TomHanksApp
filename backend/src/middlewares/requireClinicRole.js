const logger = require('../utils/logger');

module.exports = (...allowedRoles) => (req, res, next) => {
  if (!req.clinicRole || !allowedRoles.includes(req.clinicRole)) {
    logger.logEvent(req.userId, `tentativa_negada_403_clinic_${req.method.toLowerCase()}_${req.baseUrl}`);
    return res.status(403).json({ error: 'Seu papel no consultório não permite esta ação.' });
  }
  return next();
};
