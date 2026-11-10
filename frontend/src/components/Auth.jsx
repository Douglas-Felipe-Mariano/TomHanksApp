import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/agendalivre-logo.svg';

const Auth = ({ onLogin }) => {
  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({ nome: '', email: '', senha: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api/auth' : '/api/auth';

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    
    const endpoint = mode === 'login' ? '/login' : '/register';
    const payload = mode === 'login'
      ? { email: formData.email, senha: formData.senha }
      : formData;
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Erro na requisição');
      }
      
      if (mode === 'forgot') {
        setSuccess(data.message || 'Se o e-mail existir, o link será enviado.');
        setFormData({ ...formData, senha: '' });
        return;
      }

      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendResetLink = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao solicitar recuperação de senha');
      }

      setSuccess(data.message || 'Se o e-mail existir, você receberá um link.');
    } catch (forgotError) {
      setError(forgotError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setError('');
    setSuccess('');
    setFormData({ nome: '', email: '', senha: '' });
  };

  return (
    <div className="auth-container auth-page">
      <Link className="auth-brand" to="/" aria-label="AgendaLivre início">
        <img src={logo} alt="AgendaLivre" />
      </Link>
      <div className="auth-card">
        <span className="auth-kicker">AGENDA MAIS LEVE, CONSULTÓRIO MAIS ORGANIZADO</span>
        <h2>
          {mode === 'login' && 'Bem-vindo de volta'}
          {mode === 'register' && 'Criar conta'}
          {mode === 'forgot' && 'Recuperar senha'}
        </h2>
        <p className="helper-text">
          {mode === 'login' && 'Entre para organizar os horários e acompanhar seu consultório.'}
          {mode === 'register' && 'Crie sua conta profissional e configure seu consultório.'}
          {mode === 'forgot' && 'Informe o e-mail para receber o link com expiração de 30 minutos.'}
        </p>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        <form onSubmit={mode === 'forgot' ? (e) => { e.preventDefault(); sendResetLink(); } : handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="auth-name">Nome</label>
              <input id="auth-name" type="text" name="nome" value={formData.nome} onChange={handleChange} autoComplete="name" required />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="auth-email">E-mail</label>
            <input id="auth-email" type="email" name="email" value={formData.email} onChange={handleChange} autoComplete="email" required />
          </div>
          {mode !== 'forgot' && (
            <div className="form-group">
              <label htmlFor="auth-password">Senha</label>
              <input id="auth-password" type="password" name="senha" value={formData.senha} onChange={handleChange} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
            </div>
          )}
          
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? 'Aguarde...'
              : mode === 'login'
                ? 'Entrar'
                : mode === 'register'
                  ? 'Cadastrar'
                  : 'Enviar link'}
          </button>
        </form>
        
        <div className="auth-actions">
          {mode === 'login' && (
            <>
              <button type="button" className="auth-toggle" onClick={() => handleModeChange('register')}>
                Não tem uma conta? Cadastre-se
              </button>
              <button type="button" className="auth-toggle" onClick={() => handleModeChange('forgot')}>
                Esqueci minha senha
              </button>
            </>
          )}
          {mode === 'register' && (
            <button type="button" className="auth-toggle" onClick={() => handleModeChange('login')}>
              Já tem uma conta? Entre
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" className="auth-toggle" onClick={() => handleModeChange('login')}>
              Voltar para o login
            </button>
          )}
        </div>

        <div className="auth-footer">
          <Link to="/reset-password" className="inline-link">
            Já recebeu o link? Abrir página de redefinição
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Auth;
