import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth';
import ClinicDashboard from './components/ClinicDashboard';
import ResetPassword from './components/ResetPassword';
import LandingPage from './components/LandingPage';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));

  const login = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = async () => {
    const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api/auth' : '/api/auth';
    const currentToken = localStorage.getItem('token');

    try {
      if (currentToken) {
        await fetch(`${API_URL}/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      }
    } catch (error) {
      console.error('Não foi possível registrar o logout:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={!token ? <Auth onLogin={login} /> : <Navigate to="/app" />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/app" element={token ? (user?.role === 'admin' ? <AdminDashboard user={user} onLogout={logout} token={token} /> : <ClinicDashboard user={user} onLogout={logout} token={token} />) : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
