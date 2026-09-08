const logServiceUrl = process.env.LOG_SERVICE_URL || 'http://log-service:3002';

exports.logEvent = (usuario_id, acao) => {
  // Fire and forget usando fetch nativo
  fetch(`${logServiceUrl}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario_id, acao })
  }).catch(err => {
    console.error('Erro ao enviar log de auditoria:', err.message);
  });
};
