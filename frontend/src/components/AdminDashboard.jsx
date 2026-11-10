import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/agendalivre-logo.svg';
import './AdminDashboard.css';

const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

function money(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);
}

export default function AdminDashboard({ user, token, onLogout }) {
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_URL}/admin/billing/summary`, { headers }).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as métricas.');
        return data;
      }),
      fetch(`${API_URL}/admin/logs?limit=12`, { headers }).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os eventos.');
        return data;
      }),
    ]).then(([metrics, events]) => {
      if (!active) return;
      setSummary(metrics);
      setLogs(Array.isArray(events) ? events : []);
    }).catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  return (
    <main className="admin-page">
      <header className="admin-header"><Link className="admin-brand" to="/" aria-label="AgendaLivre início"><img src={logo} alt="AgendaLivre" /><small>ADMIN</small></Link><div><span>{user?.nome || 'Administrador'}</span><button onClick={onLogout}>Sair</button></div></header>
      <section className="admin-content">
        <div className="admin-title"><div><span>CONTROLE DA PLATAFORMA</span><h1>Resumo do negócio</h1><p>Indicadores de assinatura e eventos recentes de auditoria.</p></div><Link to="/">Ver site público ↗</Link></div>
        {error && <div className="admin-error" role="alert">{error}</div>}
        {loading ? <div className="admin-loading">Carregando métricas seguras…</div> : <>
          <div className="admin-metrics">
            <article><span>MRR de teste</span><strong>{money(summary?.mrrCents)}</strong><small>Soma mensal das assinaturas Pro ativas</small></article>
            <article><span>Assinaturas ativas</span><strong>{summary?.activeSubscriptions ?? 0}</strong><small>Pro em estado active ou trialing</small></article>
            <article><span>Contas Free</span><strong>{summary?.freeUsers ?? 0}</strong><small>Contas sem benefício Pro ativo</small></article>
            <article><span>Contas Pro</span><strong>{summary?.proUsers ?? 0}</strong><small>Estado mantido pelos webhooks Stripe</small></article>
          </div>
          <section className="admin-events"><div><span>TRILHA DE AUDITORIA</span><h2>Eventos recentes</h2><p>{summary?.users ?? 0} contas cadastradas na plataforma</p></div>
            {logs.length ? <div className="admin-event-list">{logs.map((event) => <article key={event.id}><span className="admin-event-icon">↗</span><div><strong>{String(event.acao || '').replaceAll('_', ' ')}</strong><small>Conta {event.usuario_id} · {event.timestamp ? new Date(event.timestamp).toLocaleString('pt-BR') : 'data indisponível'}</small></div></article>)}</div> : <div className="admin-empty">Nenhum evento foi registrado ainda.</div>}
          </section>
        </>}
        <footer className="admin-note">Ambiente de demonstração. MRR calculado em centavos a partir do estado local sincronizado pelo webhook; configure apenas chaves e preços de teste.</footer>
      </section>
    </main>
  );
}
