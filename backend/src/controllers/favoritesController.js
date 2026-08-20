const db = require('../config/database');

exports.addFavorite = async (req, res) => {
  const { tmdb_movie_id, titulo, poster_path } = req.body;
  const usuario_id = req.userId; // Vem do token JWT

  try {
    await db.execute(
      'INSERT INTO favoritos (usuario_id, tmdb_movie_id, titulo, poster_path) VALUES (?, ?, ?, ?)',
      [usuario_id, tmdb_movie_id, titulo, poster_path]
    );
    res.status(201).json({ message: 'Favorito adicionado com sucesso!' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Filme já favoritado por você.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro ao favoritar filme' });
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
