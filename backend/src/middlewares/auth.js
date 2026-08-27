const axios = require('axios');

const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2) {
    return res.status(401).json({ error: 'Erro de Token' });
  }

  const [scheme] = parts;

  if (!/^Bearer$/i.test(scheme)) {
    return res.status(401).json({ error: 'Token mal formatado' });
  }

  try {
    const response = await axios.get(`${authServiceUrl}/auth/me`, {
      headers: { authorization: authHeader },
      validateStatus: () => true,
    });

    if (response.status !== 200 || !response.data?.user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    req.user = response.data.user;
    req.userId = response.data.user.id;
    req.userRole = response.data.user.role;
    return next();
  } catch (error) {
    console.error('Erro ao validar token no serviço de autenticação:', error.message);
    return res.status(503).json({ error: 'Serviço de autenticação indisponível' });
  }
};
