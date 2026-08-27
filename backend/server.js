require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const moviesController = require('./src/controllers/moviesController');
const favoritesController = require('./src/controllers/favoritesController');
const commentsController = require('./src/controllers/commentsController');
const authMiddleware = require('./src/middlewares/auth');

const app = express();
app.use(cors());
app.use(express.json());

const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

const forwardAuthRequest = async (req, res) => {
  try {
    const upstreamPath = `/auth${req.url}`;
    const response = await axios({
      method: req.method,
      url: `${authServiceUrl}${upstreamPath}`,
      data: req.body,
      headers: {
        authorization: req.headers.authorization,
      },
      validateStatus: () => true,
    });

    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Erro ao encaminhar requisição de autenticação:', error.message);
    return res.status(503).json({ error: 'Serviço de autenticação indisponível' });
  }
};

// Rotas públicas de autenticação, encaminhadas para o microsserviço interno
app.use('/api/auth', forwardAuthRequest);

// Rotas protegidas
app.use('/api', authMiddleware);

const path = require('path');

app.get('/api/movies', moviesController.searchMovies);
app.get('/api/movies/:id/details', moviesController.getMovieDetails);

app.post('/api/favorites', favoritesController.addFavorite);
app.get('/api/favorites', favoritesController.listFavorites);
app.delete('/api/favorites/:id', favoritesController.removeFavorite);

app.post('/api/comments', commentsController.addComment);
app.get('/api/comments', commentsController.listComments);
app.delete('/api/comments/:id', commentsController.removeComment);

// Serve o frontend estático se estiver no Docker/Produção
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Redireciona qualquer rota não API para o index.html do React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
