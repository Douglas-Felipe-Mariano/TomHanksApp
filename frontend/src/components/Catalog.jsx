import React, { useState, useEffect } from 'react';

const Catalog = ({ user, onLogout, token }) => {
  const [movies, setMovies] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [comments, setComments] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all' ou 'favorites'
  const [commentInputs, setCommentInputs] = useState({});

  const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  useEffect(() => {
    fetchMovies();
    fetchFavorites();
    fetchComments();
  }, []);

  const fetchMovies = async () => {
    try {
      const res = await fetch(`${API_URL}/movies`, { headers });
      const data = await res.json();
      setMovies(data);
    } catch (err) { console.error(err); }
  };

  const fetchFavorites = async () => {
    try {
      const res = await fetch(`${API_URL}/favorites`, { headers });
      const data = await res.json();
      setFavorites(data);
    } catch (err) { console.error(err); }
  };

  const fetchComments = async () => {
    try {
      const res = await fetch(`${API_URL}/comments`, { headers });
      const data = await res.json();
      setComments(data);
    } catch (err) { console.error(err); }
  };

  const toggleFavorite = async (movie) => {
    const isFav = favorites.find(f => f.tmdb_movie_id === movie.id);
    try {
      if (isFav) {
        await fetch(`${API_URL}/favorites/${isFav.id}`, { method: 'DELETE', headers });
      } else {
        await fetch(`${API_URL}/favorites`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            tmdb_movie_id: movie.id,
            titulo: movie.title,
            poster_path: movie.poster_path
          })
        });
      }
      fetchFavorites();
    } catch (err) { console.error(err); }
  };

  const addComment = async (movieId) => {
    const text = commentInputs[movieId];
    if (!text) return;

    try {
      await fetch(`${API_URL}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tmdb_movie_id: movieId, texto: text })
      });
      setCommentInputs({ ...commentInputs, [movieId]: '' });
      fetchComments();
    } catch (err) { console.error(err); }
  };

  const deleteComment = async (id) => {
    try {
      await fetch(`${API_URL}/comments/${id}`, { method: 'DELETE', headers });
      fetchComments();
    } catch (err) { console.error(err); }
  };

  const displayMovies = activeTab === 'all' 
    ? movies 
    : movies.filter(m => favorites.some(f => f.tmdb_movie_id === m.id));

  return (
    <div>
      <nav className="navbar">
        <h1>Tom Hanks Collection</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span>Olá, {user.nome} ({user.role || 'usuario'})</span>
          <button className="btn btn-danger" onClick={onLogout}>Sair</button>
        </div>
      </nav>

      <div className="catalog-container">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Todos os Filmes
          </button>
          <button 
            className={`tab ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            Meus Favoritos
          </button>
        </div>

        <div className="movies-grid">
          {displayMovies.map(movie => {
            const isFav = favorites.some(f => f.tmdb_movie_id === movie.id);
            const movieComments = comments.filter(c => c.tmdb_movie_id === movie.id);

            return (
              <div key={movie.id} className="movie-card">
                {movie.poster_path ? (
                  <img 
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} 
                    alt={movie.title} 
                    className="movie-poster"
                  />
                ) : (
                  <div className="movie-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Sem imagem
                  </div>
                )}
                
                <div className="movie-info">
                  <div className="movie-title">{movie.title}</div>
                  
                  <div className="movie-actions">
                    <button 
                      className={`btn-icon ${isFav ? 'active' : ''}`}
                      onClick={() => toggleFavorite(movie)}
                      title="Favoritar"
                    >
                      {isFav ? '♥' : '♡'}
                    </button>
                  </div>

                  {/* Comments */}
                  <div className="comment-section">
                    <input 
                      type="text" 
                      placeholder="Deixe um comentário..." 
                      className="comment-input"
                      value={commentInputs[movie.id] || ''}
                      onChange={(e) => setCommentInputs({ ...commentInputs, [movie.id]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addComment(movie.id)}
                    />
                    <div className="comment-list">
                      {movieComments.map(c => (
                        <div key={c.id} className="comment-item">
                          <span>{c.texto}</span>
                          <button onClick={() => deleteComment(c.id)} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Catalog;
