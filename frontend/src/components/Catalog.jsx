import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

const Catalog = ({ user, onLogout, token }) => {
  const [movies, setMovies] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [comments, setComments] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all' ou 'favorites'
  const [commentInputs, setCommentInputs] = useState({});
  const [premiumStatus, setPremiumStatus] = useState({ premium: false, favoriteLimit: 5 });
  const [billingMessage, setBillingMessage] = useState(() => {
    const checkoutResult = new URLSearchParams(window.location.search).get('checkout');
    if (checkoutResult === 'success') {
      return 'Pagamento concluído. Aguardando a confirmação segura do Stripe…';
    }
    if (checkoutResult === 'cancelled') {
      return 'Checkout cancelado. Nenhuma cobrança foi feita.';
    }
    return '';
  });
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);

  const headers = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  useEffect(() => {
    let active = true;
    let confirmationTimer;
    const checkoutResult = new URLSearchParams(window.location.search).get('checkout');

    const refreshPremiumStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/billing/status`, { headers });
        if (!res.ok) return null;
        const data = await res.json();
        if (active) setPremiumStatus(data);
        return data;
      } catch (err) {
        console.error('Não foi possível consultar o plano:', err);
        return null;
      }
    };

    if (checkoutResult === 'success') {
      let attempts = 0;
      const confirmPayment = async () => {
        const status = await refreshPremiumStatus();
        if (!active) return;
        if (status?.premium) {
          setBillingMessage('Plano Premium ativado. Seus favoritos agora são ilimitados.');
          return;
        }
        attempts += 1;
        if (attempts >= 10) {
          setBillingMessage('O pagamento ainda está sendo confirmado. Atualize o catálogo em alguns instantes.');
          return;
        }
        confirmationTimer = window.setTimeout(confirmPayment, 2000);
      };
      confirmPayment();
    } else {
      refreshPremiumStatus();
    }

    return () => {
      active = false;
      window.clearTimeout(confirmationTimer);
    };
  }, [headers]);

  const fetchMovies = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/movies`, { headers });
      const data = await res.json();
      setMovies(data);
    } catch (err) { console.error(err); }
  }, [headers]);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/favorites`, { headers });
      const data = await res.json();
      setFavorites(data);
    } catch (err) { console.error(err); }
  }, [headers]);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/comments`, { headers });
      const data = await res.json();
      setComments(data);
    } catch (err) { console.error(err); }
  }, [headers]);

  useEffect(() => {
    fetchMovies();
    fetchFavorites();
    fetchComments();
  }, [fetchMovies, fetchFavorites, fetchComments]);

  const toggleFavorite = async (movie) => {
    const isFav = favorites.find(f => f.tmdb_movie_id === movie.id);
    try {
      if (isFav) {
        await fetch(`${API_URL}/favorites/${isFav.id}`, { method: 'DELETE', headers });
      } else {
        const response = await fetch(`${API_URL}/favorites`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            tmdb_movie_id: movie.id,
            titulo: movie.title,
            poster_path: movie.poster_path
          })
        });
        if (!response.ok) {
          const result = await response.json();
          setBillingMessage(result.error || 'Não foi possível adicionar o favorito.');
          return;
        }
      }
      fetchFavorites();
    } catch (err) { console.error(err); }
  };

  const startCheckout = async () => {
    setIsStartingCheckout(true);
    setBillingMessage('');
    try {
      const response = await fetch(`${API_URL}/billing/checkout`, {
        method: 'POST',
        headers,
      });
      const result = await response.json();
      if (!response.ok || !result.url) {
        setBillingMessage(result.error || 'Não foi possível iniciar o checkout.');
        return;
      }
      window.location.assign(result.url);
    } catch (err) {
      console.error('Erro ao iniciar checkout:', err);
      setBillingMessage('Não foi possível conectar ao checkout do Stripe.');
    } finally {
      setIsStartingCheckout(false);
    }
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
          <span className={`premium-badge ${premiumStatus.premium ? 'is-premium' : ''}`}>
            {premiumStatus.premium ? 'Premium' : 'Free'}
          </span>
          <Link to={`/profile/${user.id}`} className="btn" style={{ textDecoration: 'none' }}>Meu Perfil</Link>
          <button className="btn btn-danger" onClick={onLogout}>Sair</button>
        </div>
      </nav>

      <div className="catalog-container">
        <section className="premium-panel">
          <div>
            <strong>{premiumStatus.premium ? 'Plano Premium ativo' : 'Plano Free'}</strong>
            <p>
              {premiumStatus.premium
                ? 'Você pode salvar favoritos sem limite.'
                : `${favorites.length} de ${premiumStatus.favoriteLimit ?? 5} favoritos usados. Premium libera favoritos ilimitados.`}
            </p>
          </div>
          {!premiumStatus.premium && (
            <button className="btn" onClick={startCheckout} disabled={isStartingCheckout}>
              {isStartingCheckout ? 'Abrindo Stripe…' : 'Conhecer Plano Premium'}
            </button>
          )}
        </section>
        {billingMessage && <p className="billing-message" role="status">{billingMessage}</p>}

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
            const freeLimitReached = !premiumStatus.premium
              && favorites.length >= (premiumStatus.favoriteLimit ?? 5);
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
                      disabled={!isFav && freeLimitReached}
                      title={!isFav && freeLimitReached ? 'Limite Free atingido; faça upgrade para favoritar mais' : 'Favoritar'}
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
