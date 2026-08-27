import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api/auth' : '/api/auth';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Token de recuperação ausente.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/reset-password/validate?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Token inválido ou expirado.');
        }

        setMessage('Token validado. Defina uma nova senha abaixo.');
      } catch (validationError) {
        setError(validationError.message);
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, senha: password }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível atualizar a senha.');
      }

      setMessage(data.message || 'Senha atualizada com sucesso.');
      setPassword('');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container reset-page">
      <div className="auth-card reset-card">
        <h2>Redefinir senha</h2>
        <p className="helper-text">
          Use o link do e-mail para criar uma nova senha.
        </p>

        {loading && <div className="info-message">Validando link...</div>}
        {!loading && error && <div className="error-message">{error}</div>}
        {!loading && message && <div className="success-message">{message}</div>}

        {!loading && token && !error && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="password">Nova senha</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
              />
            </div>

            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? 'Atualizando...' : 'Trocar senha'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <Link to="/login" className="inline-link">
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;