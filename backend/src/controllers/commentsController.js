const db = require('../config/database');

exports.addComment = async (req, res) => {
  const { tmdb_movie_id, texto } = req.body;
  const usuario_id = req.userId;

  try {
    await db.execute(
      'INSERT INTO comentarios (usuario_id, tmdb_movie_id, texto) VALUES (?, ?, ?)',
      [usuario_id, tmdb_movie_id, texto]
    );
    res.status(201).json({ message: 'Comentário adicionado!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar comentário' });
  }
};

exports.listComments = async (req, res) => {
  const usuario_id = req.userId;
  const tmdb_movie_id = req.query.tmdb_movie_id; // opcional para filtrar por filme

  try {
    let query = 'SELECT * FROM comentarios WHERE usuario_id = ?';
    const params = [usuario_id];

    if (tmdb_movie_id) {
      query += ' AND tmdb_movie_id = ?';
      params.push(tmdb_movie_id);
    }

    query += ' ORDER BY criado_em DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar comentários' });
  }
};

exports.removeComment = async (req, res) => {
  const { id } = req.params;
  const usuario_id = req.userId;

  try {
    await db.execute(
      'DELETE FROM comentarios WHERE id = ? AND usuario_id = ?',
      [id, usuario_id]
    );
    res.json({ message: 'Comentário removido' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover comentário' });
  }
};
