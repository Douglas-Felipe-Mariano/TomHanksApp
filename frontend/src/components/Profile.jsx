import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const Profile = ({ token, user }) => {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';
  const headers = {
    'Authorization': `Bearer ${token}`
  };

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/profile/${id}`, { headers });
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
        setBio(data.bio || '');
      } else {
        setError(data.error || 'Erro ao carregar perfil');
      }
    } catch (err) {
      setError('Erro ao carregar perfil');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const formData = new FormData();
    formData.append('bio', bio);
    if (file) {
      formData.append('profile_picture', file);
    }

    try {
      const res = await fetch(`${API_URL}/profile/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}` // Sem Content-Type, o browser preenche com boundary pro FormData
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('Perfil atualizado com sucesso!');
        setIsEditing(false);
        fetchProfile();
      } else {
        setError(data.error || 'Erro ao atualizar perfil');
      }
    } catch (err) {
      setError('Erro ao atualizar perfil');
    }
  };

  if (error && !profile) return <div className="profile-container"><div className="error">{error}</div><Link to="/">Voltar</Link></div>;
  if (!profile) return <div className="profile-container">Carregando...</div>;

  return (
    <div>
      <nav className="navbar">
        <h1>Perfil de Usuário</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link to="/" className="btn" style={{ textDecoration: 'none' }}>Voltar para o Catálogo</Link>
        </div>
      </nav>

      <div className="profile-container" style={{ maxWidth: '800px', margin: '2rem auto', padding: '1rem', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        {error && <div className="error" style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
        {message && <div className="success" style={{ color: 'green', marginBottom: '1rem' }}>{message}</div>}
        
        <div className="profile-header" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div className="profile-picture">
            {profile.foto_perfil ? (
              <img src={profile.foto_perfil} alt={`Foto de ${profile.nome}`} style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '150px', height: '150px', borderRadius: '50%', background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Sem foto
              </div>
            )}
          </div>
          <div className="profile-info" style={{ flex: 1 }}>
            <h2>{profile.nome}</h2>
            <p><strong>Email:</strong> {profile.email}</p>
            <p><strong>Papel:</strong> {profile.role}</p>
            <p><strong>Bio:</strong> {profile.bio || 'Sem bio disponível.'}</p>
            
            {profile.isOwnProfile && !isEditing && (
              <button className="btn" onClick={() => setIsEditing(true)} style={{ marginTop: '1rem' }}>Editar Perfil</button>
            )}
          </div>
        </div>

        {isEditing && (
          <form onSubmit={handleUpdate} style={{ marginBottom: '2rem', padding: '1rem', background: '#f9f9f9', borderRadius: '8px' }}>
            <h3>Editar Perfil</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Nova Foto de Perfil:</label>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Bio:</label>
              <textarea 
                value={bio} 
                onChange={(e) => setBio(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn btn-primary">Salvar</button>
              <button type="button" className="btn" onClick={() => setIsEditing(false)}>Cancelar</button>
            </div>
          </form>
        )}

        <div className="profile-favorites">
          <h3>Filmes Favoritos de {profile.nome}</h3>
          {profile.favorites && profile.favorites.length > 0 ? (
            <div className="movies-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              {profile.favorites.map(movie => (
                <div key={movie.id} className="movie-card" style={{ padding: '0.5rem', background: '#f5f5f5', borderRadius: '8px' }}>
                  {movie.poster_path ? (
                    <img 
                      src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`} 
                      alt={movie.titulo} 
                      style={{ width: '100%', borderRadius: '4px' }}
                    />
                  ) : (
                    <div style={{ height: '225px', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Sem Imagem</div>
                  )}
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold' }}>{movie.titulo}</div>
                </div>
              ))}
            </div>
          ) : (
            <p>Nenhum filme favoritado ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
