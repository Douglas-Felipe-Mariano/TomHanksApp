const db = require('../config/database');
const logger = require('../utils/logger');

const FREE_FAVORITE_LIMIT = 5;

exports.addFavorite = async (req, res) => {
  const { tmdb_movie_id, titulo, poster_path } = req.body;
  const usuario_id = req.userId; // Vem do token JWT
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // O plano é consultado no banco em cada escrita; o cliente não pode conceder Premium.
    const [users] = await connection.execute(
      'SELECT premium FROM usuarios WHERE id = ? FOR UPDATE',
      [usuario_id]
    );
    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const isPremium = Boolean(Number(users[0].premium));
    if (!isPremium) {
      const [counts] = await connection.execute(
        'SELECT COUNT(*) AS total FROM favoritos WHERE usuario_id = ?',
        [usuario_id]
      );
      const currentCount = Number(counts[0].total);
      if (currentCount >= FREE_FAVORITE_LIMIT) {
        await connection.rollback();
        logger.logEvent(usuario_id, 'limite_free_favoritos_atingido');
        return res.status(403).json({
          error: `O plano Free permite até ${FREE_FAVORITE_LIMIT} favoritos. Faça upgrade para o Premium e salve sem limite.`,
          code: 'PREMIUM_REQUIRED',
          limit: FREE_FAVORITE_LIMIT,
          current: currentCount,
        });
      }
    }

    await connection.execute(
      'INSERT INTO favoritos (usuario_id, tmdb_movie_id, titulo, poster_path) VALUES (?, ?, ?, ?)',
      [usuario_id, tmdb_movie_id, titulo, poster_path]
    );
    await connection.commit();
    logger.logEvent(usuario_id, 'adicionar_favorito');
    return res.status(201).json({ message: 'Favorito adicionado com sucesso!' });
  } catch (err) {
    if (connection) await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Filme já favoritado por você.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao favoritar filme' });
  } finally {
    if (connection) connection.release();
  }
};

exports.listFavorites = async (req, res) => {
  const usuario_id = req.userId;

  try {
    const [rows] = await db.execute(
      'SELECT * FROM favoritos WHERE usuario_id = ? ORDER BY criado_em DESC',
      [usuario_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar favoritos' });
  }
};

exports.removeFavorite = async (req, res) => {
  const { id } = req.params;
  const usuario_id = req.userId;

  try {
    await db.execute(
      'DELETE FROM favoritos WHERE id = ? AND usuario_id = ?',
      [id, usuario_id]
    );
    res.json({ message: 'Favorito removido com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover favorito' });
  }
};
