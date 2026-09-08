const db = require('../config/database');
const logger = require('../utils/logger');

exports.addComment = async (req, res) => {
  const { tmdb_movie_id, texto } = req.body;
  const usuario_id = req.userId;

  try {
    await db.execute(
      'INSERT INTO comentarios (usuario_id, tmdb_movie_id, texto) VALUES (?, ?, ?)',
      [usuario_id, tmdb_movie_id, texto]
    );
    logger.logEvent(usuario_id, 'adicionar_comentario');
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
  const role = req.userRole;

  try {
    // 1. Busca o comentário para saber quem é o dono
    const [rows] = await db.execute('SELECT usuario_id FROM comentarios WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Comentário não encontrado' });
    }
    
    const dono_id = rows[0].usuario_id;
    
    // 2. Validação RBAC (Role-Based Access Control)
    // Se o usuário não for admin, ele só pode apagar se for o dono do comentário.
    if (role !== 'admin' && dono_id !== usuario_id) {
      logger.logEvent(usuario_id, 'tentativa_negada_403_apagar_comentario');
      return res.status(403).json({ error: 'Proibido: Você não tem permissão para apagar este comentário' });
    }
    
    // 3. Executa a exclusão
    await db.execute('DELETE FROM comentarios WHERE id = ?', [id]);
    
    const acao = (role === 'admin' && dono_id !== usuario_id) ? 'remocao_moderacao' : 'remover_comentario_proprio';
    logger.logEvent(usuario_id, acao);
    
    res.json({ message: 'Comentário removido' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover comentário' });
  }
};
