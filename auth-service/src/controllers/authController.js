const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const db = require('../config/database');
const mailer = require('../config/mailer');

const RESET_TOKEN_MINUTES = Number(process.env.RESET_TOKEN_MINUTES || 30);
const PUBLIC_APP_URL = (process.env.APP_PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '24h' }
  );
}

function mapUser(row) {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    role: row.role || 'usuario',
  };
}

async function sendResetEmail(email, token) {
  const resetLink = `${PUBLIC_APP_URL}/reset-password?token=${encodeURIComponent(token)}`;

  await mailer.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Recuperação de senha - Tom Hanks App',
    text: `Recebemos uma solicitação para redefinir sua senha. Use o link abaixo em até ${RESET_TOKEN_MINUTES} minutos:\n${resetLink}\n\nSe você não solicitou isso, ignore esta mensagem.`,
    html: `
      <p>Recebemos uma solicitação para redefinir sua senha.</p>
      <p><a href="${resetLink}">Clique aqui para redefinir sua senha</a></p>
      <p>Esse link expira em ${RESET_TOKEN_MINUTES} minutos.</p>
      <p>Se você não solicitou isso, ignore esta mensagem.</p>
    `,
  });
}

exports.register = async (req, res) => {
  const { nome, email, senha } = req.body;

  try {
    const [rows] = await db.execute('SELECT id FROM usuarios WHERE email = ?', [email]);

    if (rows.length > 0) {
      return res.status(400).json({ error: 'Usuário já existe' });
    }

    const hash = await bcrypt.hash(senha, 10);
    const [result] = await db.execute(
      'INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, ?)',
      [nome, email, hash, 'usuario']
    );

    const user = { id: result.insertId, nome, email, role: 'usuario' };
    const token = generateToken(user);

    return res.status(201).json({ user, token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
};

exports.login = async (req, res) => {
  const { email, senha } = req.body;

  try {
    const [rows] = await db.execute('SELECT * FROM usuarios WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Usuário não encontrado' });
    }

    const user = rows[0];

    if (!(await bcrypt.compare(senha, user.senha_hash))) {
      return res.status(400).json({ error: 'Senha inválida' });
    }

    const currentUser = mapUser(user);
    const token = generateToken(currentUser);

    return res.json({ user: currentUser, token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro no login' });
  }
};

exports.me = async (req, res) => {
  return res.json({ user: req.user });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const [rows] = await db.execute('SELECT id, email FROM usuarios WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.json({ message: 'Se o e-mail existir, você receberá um link de redefinição.' });
    }

    const user = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);

    await db.execute(
      'INSERT INTO reset_tokens (token, usuario_id, criado_em, expira_em, usado) VALUES (?, ?, NOW(), ?, FALSE)',
      [token, user.id, expiresAt]
    );

    await sendResetEmail(user.email, token);

    return res.json({ message: 'Se o e-mail existir, você receberá um link de redefinição.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao solicitar recuperação de senha' });
  }
};

exports.validateResetToken = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token não informado' });
  }

  try {
    const [rows] = await db.execute(
      'SELECT token, usado, expira_em FROM reset_tokens WHERE token = ? LIMIT 1',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido' });
    }

    const resetToken = rows[0];

    if (resetToken.usado || new Date(resetToken.expira_em) <= new Date()) {
      return res.status(400).json({ error: 'Token expirado ou já utilizado' });
    }

    return res.json({ valid: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao validar token' });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, senha } = req.body;

  if (!token || !senha) {
    return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      'SELECT token, usuario_id, usado, expira_em FROM reset_tokens WHERE token = ? LIMIT 1 FOR UPDATE',
      [token]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Token inválido' });
    }

    const resetToken = rows[0];

    if (resetToken.usado || new Date(resetToken.expira_em) <= new Date()) {
      await connection.rollback();
      return res.status(400).json({ error: 'Token expirado ou já utilizado' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    await connection.execute('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [senhaHash, resetToken.usuario_id]);
    await connection.execute('UPDATE reset_tokens SET usado = TRUE WHERE token = ?', [token]);

    await connection.commit();
    return res.json({ message: 'Senha atualizada com sucesso' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    return res.status(500).json({ error: 'Erro ao redefinir senha' });
  } finally {
    connection.release();
  }
};