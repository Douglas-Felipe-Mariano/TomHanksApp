const pool = require('../config/database');
const { minioClient, bucketName } = require('../config/minio');
const multer = require('multer');
const path = require('path');
const logger = require('../utils/logger');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg' && ext !== '.webp') {
      return cb(new Error('Apenas imagens são permitidas'));
    }
    cb(null, true);
  }
}).single('profile_picture');

const getProfile = async (req, res) => {
  const userId = req.params.id || req.userId;
  
  try {
    const [users] = await pool.query(
      'SELECT id, nome, email, role, bio, foto_perfil FROM usuarios WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = users[0];

    const [favorites] = await pool.query(
      'SELECT id, tmdb_movie_id, titulo, poster_path, criado_em FROM favoritos WHERE usuario_id = ? ORDER BY criado_em DESC',
      [userId]
    );

    user.favorites = favorites;

    // Se o profile é do usuário atual, adicionamos um campo para ajudar no frontend
    user.isOwnProfile = (userId == req.userId);

    res.json(user);
  } catch (error) {
    console.error('Erro ao buscar perfil:', error.message);
    res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
};

const updateProfile = async (req, res) => {
  // Apenas o próprio usuário pode editar seu perfil
  const userId = req.params.id;
  if (userId != req.userId) {
    logger.logEvent(req.userId, 'tentativa_negada_403_editar_perfil_alheio');
    return res.status(403).json({ error: 'Proibido: Você só pode editar o seu próprio perfil' });
  }

  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { bio } = req.body;
    let fotoPerfil = null;

    if (req.file) {
      const fileName = `profile_${userId}_${Date.now()}${path.extname(req.file.originalname)}`;
      
      try {
        await minioClient.putObject(bucketName, fileName, req.file.buffer, req.file.size, {
          'Content-Type': req.file.mimetype
        });
        
        // URL pública baseada no endpoint do Minio (com bucketName e fileName)
        // Se usar MinIO rodando local na porta 9000, o cliente acessa via localhost
        const minioPublicUrl = process.env.MINIO_PUBLIC_URL || 'http://localhost:9000';
        fotoPerfil = `${minioPublicUrl}/${bucketName}/${fileName}`;
      } catch (uploadError) {
        console.error('Erro no upload para o MinIO:', uploadError);
        return res.status(500).json({ error: 'Erro ao fazer upload da imagem' });
      }
    }

    try {
      if (fotoPerfil && bio !== undefined) {
        await pool.query('UPDATE usuarios SET bio = ?, foto_perfil = ? WHERE id = ?', [bio, fotoPerfil, userId]);
      } else if (fotoPerfil) {
        await pool.query('UPDATE usuarios SET foto_perfil = ? WHERE id = ?', [fotoPerfil, userId]);
      } else if (bio !== undefined) {
        await pool.query('UPDATE usuarios SET bio = ? WHERE id = ?', [bio, userId]);
      }
      
      res.json({ message: 'Perfil atualizado com sucesso', foto_perfil: fotoPerfil });
    } catch (dbError) {
      console.error('Erro ao atualizar banco:', dbError);
      res.status(500).json({ error: 'Erro ao atualizar perfil no banco de dados' });
    }
  });
};

module.exports = {
  getProfile,
  updateProfile
};
