const logServiceUrl = process.env.LOG_SERVICE_URL || 'http://log-service:3002';

exports.logEvent = async (usuario_id, acao) => {
  try {
    const response = await fetch(`${logServiceUrl}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id, acao })
    });

    if (!response.ok) {
      throw new Error(`Log service respondeu com HTTP ${response.status}`);
    }
  } catch (err) {
    console.error('Erro ao enviar log de auditoria:', err.message);
  }
};
