const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

exports.searchMovies = async (req, res) => {
  try {
    // Tom Hanks person_id on TMDB is 31
    const response = await axios.get(`${TMDB_BASE_URL}/person/31/movie_credits`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'pt-BR'
      }
    });

    res.json(response.data.cast);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar filmes no TMDB' });
  }
};

exports.getMovieDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/movie/${id}`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'pt-BR'
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar detalhes do filme' });
  }
};
