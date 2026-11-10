import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/agendalivre-logo.svg';
import './LandingPage.css';

const features = [
  { icon: '▦', title: 'Agenda sem conflitos', text: 'Visualize atendimentos, confirme horários e evite reservas sobrepostas.' },
  { icon: '↗', title: 'Preencha horários vagos', text: 'Organize uma lista de espera e encontre pessoas que podem aproveitar uma vaga.' },
  { icon: '✳', title: 'Retornos com consentimento', text: 'No Pro, revise sugestões administrativas e envie mensagens somente a quem autorizou.' },
];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <Link className="landing-brand" to="/" aria-label="AgendaLivre início"><img src={logo} alt="AgendaLivre" /></Link>
        <div className="landing-nav-actions"><a href="#recursos">Recursos</a><Link className="landing-login" to="/login">Entrar</Link><Link className="landing-cta landing-cta-small" to="/login">Começar grátis</Link></div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-kicker"><i /> AGENDA MAIS LEVE, CONSULTÓRIO MAIS ORGANIZADO</span>
          <h1>Menos horários vazios.<br /><em>Mais cuidado com o tempo.</em></h1>
          <p>Uma agenda simples para consultórios independentes organizarem atendimentos, pacientes e lista de espera — sem planilhas espalhadas.</p>
          <div className="landing-hero-actions"><Link className="landing-cta" to="/login">Organizar meu consultório <span>→</span></Link><a className="landing-text-link" href="#como-funciona">Conheça a plataforma</a></div>
          <div className="landing-trust"><span className="landing-avatars"><i>✓</i><i>⌂</i><i>♡</i></span><span>Feita para rotinas reais de consultório</span></div>
        </div>
        <div className="landing-visual" aria-label="Prévia ilustrativa do painel AgendaLivre">
          <div className="landing-orbit orbit-one" /><div className="landing-orbit orbit-two" />
          <div className="landing-dashboard-card">
            <div className="landing-card-head"><span><b>Bom dia, Ana</b><small>Quarta-feira, 12 de novembro</small></span><span className="landing-profile-dot">A</span></div>
            <div className="landing-preview-stats"><div><small>Atendimentos hoje</small><strong>08</strong><i>+2 nesta semana</i></div><div><small>Horários livres</small><strong>03</strong><i>na agenda de hoje</i></div></div>
            <div className="landing-agenda-head"><strong>Próximos horários</strong><span>Ver agenda →</span></div>
            <div className="landing-appointment"><time>09:30</time><i className="appointment-dot dot-lilac" /><span><b>Mariana Costa</b><small>Consulta · Dra. Ana</small></span><em>Confirmado</em></div>
            <div className="landing-appointment"><time>10:15</time><i className="appointment-dot dot-green" /><span><b>Rafael Souza</b><small>Retorno · Dra. Ana</small></span><em className="appointment-waiting">Agendado</em></div>
            <div className="landing-open-slot"><span>✦</span><div><b>Uma vaga acabou de abrir</b><small>3 pessoas na lista de espera</small></div><strong>Ver lista</strong></div>
          </div>
          <div className="landing-float-note"><span>✓</span><div><b>Agenda organizada</b><small>Um horário de cada vez</small></div></div>
          <span className="landing-spark spark-one">✳</span><span className="landing-spark spark-two">✦</span>
        </div>
      </section>

      <section className="landing-proof"><span>AGENDA</span><i /><span>PACIENTES</span><i /><span>LISTA DE ESPERA</span><i /><span>RETORNOS</span></section>

      <section className="landing-features" id="recursos">
        <div className="landing-section-heading" id="como-funciona"><span className="landing-kicker">TUDO NO MESMO LUGAR</span><h2>Mais clareza para cuidar<br />da rotina do consultório.</h2><p>O essencial para acompanhar a agenda sem transformar o dia em trabalho administrativo.</p></div>
        <div className="landing-feature-grid">{features.map((feature) => <article className="landing-feature" key={feature.title}><span className="landing-feature-icon">{feature.icon}</span><h3>{feature.title}</h3><p>{feature.text}</p><a href="#planos">Saiba mais <span>→</span></a></article>)}</div>
      </section>

      <section className="landing-pricing" id="planos"><div><span className="landing-kicker">COMECE NO SEU RITMO</span><h2>Organização que cabe<br />na sua rotina.</h2><p>Experimente o plano Free e conheça os recursos essenciais. O Pro amplia o uso e ativa ferramentas de ocupação da agenda.</p><Link className="landing-cta" to="/login">Criar conta gratuita <span>→</span></Link></div><div className="landing-plan-card"><span className="landing-plan-badge">PARA COMEÇAR</span><h3>Free</h3><strong>R$ 0 <small>/ mês</small></strong><p>Agenda, cadastro de pacientes e lista de espera.</p><hr /><span>✓ Até 3 novos agendamentos por mês</span><span>✓ Visão geral do consultório</span><span>✓ Sem cartão de crédito</span><Link to="/login">Criar conta <span>→</span></Link><small className="landing-plan-footnote">Plano Pro e preço mensal configurados pelo consultório no checkout de teste.</small></div></section>

      <footer className="landing-footer"><Link className="landing-brand" to="/" aria-label="AgendaLivre início"><img src={logo} alt="AgendaLivre" /></Link><span>Rotina mais leve para quem cuida.</span><Link to="/login">Acessar plataforma</Link></footer>
    </main>
  );
}
