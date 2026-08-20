const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

function generateToken(params = {}) {
  return jwt.sign(params, process.env.JWT_SECRET || 'secret', {
    expiresIn: 86400,
  });
}

exports.register = async (req, res) => {
  const { nome, email, senha } = req.body;

  try {
    const [rows] = await db.execute('SELECT email FROM usuarios WHERE email = ?', [email]);
    if (rows.length > 0) {
      return res.status(400).json({ error: 'Usuário já existe' });
    }

    const hash = await bcrypt.hash(senha, 10);
    const [result] = await db.execute(
      'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)',
      [nome, email, hash]
    );

    const token = generateToken({ id: result.insertId });
    res.status(201).json({ user: { id: result.insertId, nome, email }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao registrar usuário' });
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

    if (!await bcrypt.compare(senha, user.senha_hash)) {
      return res.status(400).json({ error: 'Senha inválida' });
    }

    user.senha_hash = undefined;

    const token = generateToken({ id: user.id });
    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no login' });
  }
};
