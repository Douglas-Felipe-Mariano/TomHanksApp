const axios = require('axios');

const logServiceUrl = process.env.LOG_SERVICE_URL || 'http://log-service:3002';

exports.logEvent = (usuario_id, acao) => {
  // Fire and forget
  axios.post(`${logServiceUrl}/logs`, { usuario_id, acao }).catch(err => {
    console.error('Erro ao enviar log de auditoria:', err.message);
  });
};
