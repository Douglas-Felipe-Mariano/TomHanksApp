import React, { useCallback, useEffect, useMemo, useState } from 'react';
import logo from '../assets/agendalivre-logo.svg';
import './ClinicDashboard.css';

const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';
const NAV_ITEMS = [
  { id: 'overview', label: 'Visão geral', icon: '⌂' },
  { id: 'calendar', label: 'Agenda', icon: '▦' },
  { id: 'patients', label: 'Pacientes', icon: '♙' },
  { id: 'waitlist', label: 'Lista de espera', icon: '↗' },
  { id: 'growth', label: 'Retorno & campanhas', icon: '✳', premium: true },
];

const emptyPatient = { name: '', email: '', phone: '', marketing_consent: false };
const emptyAppointment = { patient_id: '', professional_name: '', start_at: '', duration_minutes: '60' };
const periodLabels = { any: 'Qualquer horário', morning: 'Manhã', afternoon: 'Tarde', evening: 'Noite' };
const statusLabels = {
  scheduled: 'Agendado', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado', no_show: 'Faltou',
};

function parseServerDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const normalized = String(value).includes('T') ? String(value) : `${String(value).replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value, options = {}) {
  const date = parseServerDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', ...options,
  }).format(date);
}

function dateTimeLocalToIso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function serverDateToLocalInput(value) {
  const date = parseServerDate(value);
  if (!date) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function getTodayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function errorMessage(data, fallback) {
  return data?.error || fallback;
}

export default function ClinicDashboard({ user, token, onLogout }) {
  const [activeSection, setActiveSection] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [team, setTeam] = useState([]);
  const [memberForm, setMemberForm] = useState({ email: '', role: 'reception' });
  const [slotSuggestions, setSlotSuggestions] = useState([]);
  const [reactivation, setReactivation] = useState({ days: 90, patients: [] });
  const [selectedPatients, setSelectedPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [patientForm, setPatientForm] = useState(emptyPatient);
  const [appointmentForm, setAppointmentForm] = useState(emptyAppointment);
  const [waitlistForm, setWaitlistForm] = useState({ patient_id: '', preferred_period: 'any', preferred_weekday: '' });
  const [campaign, setCampaign] = useState({ subject: 'Um horário especial está disponível', message: '' });
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorMessage(data, 'Não foi possível concluir a solicitação.'));
    return data;
  }, [headers]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    const bounds = getTodayBounds();
    try {
      const [dashboardData, patientData, appointmentData, waitlistData] = await Promise.all([
        request(`/clinic/dashboard?from=${encodeURIComponent(bounds.from)}&to=${encodeURIComponent(bounds.to)}`),
        request('/patients'),
        request('/appointments'),
        request('/waitlist'),
      ]);
      setDashboard(dashboardData);
      setPatients(patientData);
      setAppointments(appointmentData);
      setWaitlist(waitlistData);
      if (dashboardData.clinicRole === 'owner') {
        setTeam(await request('/clinic/members'));
      } else {
        setTeam([]);
      }
      if (dashboardData.premium) {
        try {
          const candidates = await request(`/premium/reactivation-candidates?days=${reactivation.days}`);
          setReactivation(candidates);
          setSelectedPatients(candidates.patients
            .filter((patient) => Boolean(Number(patient.marketing_consent)) && patient.email)
            .map((patient) => patient.id));
        } catch (premiumError) {
          setError(premiumError.message);
        }
      }
      return dashboardData;
    } catch (loadError) {
      setError(loadError.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [request, reactivation.days]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const checkoutResult = new URLSearchParams(window.location.search).get('checkout');
    if (checkoutResult !== 'success') return undefined;
    let active = true;
    let attempts = 0;
    let timer;
    window.history.replaceState({}, '', window.location.pathname);
    setMessage('Pagamento recebido. Aguardando a confirmação segura do Stripe…');
    const confirmCheckout = async () => {
      const current = await loadData();
      if (!active) return;
      if (current?.premium) {
        setMessage('Plano Pro ativado com sucesso.');
        return;
      }
      attempts += 1;
      if (attempts >= 10) {
        setMessage('A confirmação ainda está em processamento. Atualize a página em alguns instantes.');
        return;
      }
      timer = window.setTimeout(confirmCheckout, 2000);
    };
    confirmCheckout();
    return () => { active = false; window.clearTimeout(timer); };
  }, [loadData]);

  const visiblePatients = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return patients;
    return patients.filter((patient) => [patient.name, patient.email, patient.phone]
      .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(normalized)));
  }, [patients, search]);

  const todaysAppointments = useMemo(() => {
    const now = new Date();
    return appointments.filter((appointment) => {
      const start = parseServerDate(appointment.start_at);
      return start && start.toDateString() === now.toDateString();
    }).sort((a, b) => parseServerDate(a.start_at) - parseServerDate(b.start_at));
  }, [appointments]);

  const openSlots = useMemo(() => {
    const clinic = dashboard?.clinic;
    if (!clinic) return null;
    const [startHour, startMinute] = clinic.workday_start.split(':').map(Number);
    const [endHour, endMinute] = clinic.workday_end.split(':').map(Number);
    const duration = Number(clinic.slot_minutes) || 60;
    const beginning = new Date();
    beginning.setHours(startHour, startMinute, 0, 0);
    const closing = new Date();
    closing.setHours(endHour, endMinute, 0, 0);
    const now = new Date();
    let free = 0;
    for (let cursor = new Date(beginning); cursor.getTime() + duration * 60_000 <= closing.getTime(); cursor = new Date(cursor.getTime() + duration * 60_000)) {
      if (cursor <= now) continue;
      const slotEnd = new Date(cursor.getTime() + duration * 60_000);
      const occupied = todaysAppointments.some((appointment) => {
        if (!['scheduled', 'confirmed'].includes(appointment.status)) return false;
        const start = parseServerDate(appointment.start_at);
        const end = parseServerDate(appointment.end_at);
        return start < slotEnd && end > cursor;
      });
      if (!occupied) free += 1;
    }
    return free;
  }, [dashboard, todaysAppointments]);

  const createPatient = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await request('/patients', { method: 'POST', body: JSON.stringify(patientForm) });
      setPatientForm(emptyPatient);
      setShowPatientForm(false);
      setMessage('Paciente cadastrado.');
      await loadData();
    } catch (formError) { setError(formError.message); }
  };

  const createAppointment = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await request(editingAppointment ? `/appointments/${editingAppointment.id}` : '/appointments', {
        method: editingAppointment ? 'PUT' : 'POST',
        body: JSON.stringify({ ...appointmentForm, start_at: dateTimeLocalToIso(appointmentForm.start_at) }),
      });
      setAppointmentForm(emptyAppointment);
      setEditingAppointment(null);
      setShowAppointmentForm(false);
      setMessage(editingAppointment ? 'Atendimento remarcado com sucesso.' : 'Horário reservado com sucesso.');
      await loadData();
    } catch (formError) { setError(formError.message); }
  };

  const updateAppointment = async (appointment, status) => {
    setError('');
    try {
      const result = await request(`/appointments/${appointment.id}/status`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
      if (status === 'cancelled' && result.waitlistSuggestions?.length) {
        setSlotSuggestions(result.waitlistSuggestions);
        setMessage(`Horário cancelado. ${result.waitlistSuggestions.length} pessoa(s) da lista podem ser contatadas.`);
      } else {
        setMessage(`Atendimento marcado como ${statusLabels[status].toLowerCase()}.`);
      }
      await loadData();
    } catch (updateError) { setError(updateError.message); }
  };

  const createWaitlistEntry = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await request('/waitlist', { method: 'POST', body: JSON.stringify(waitlistForm) });
      setWaitlistForm({ patient_id: '', preferred_period: 'any', preferred_weekday: '' });
      setShowWaitlistForm(false);
      setMessage('Paciente adicionado à lista de espera.');
      await loadData();
    } catch (formError) { setError(formError.message); }
  };

  const updateWaitlist = async (entry, status) => {
    try {
      await request(`/waitlist/${entry.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMessage(status === 'contacted' ? `Lembrete: entre em contato com ${entry.patient_name} pelo canal autorizado.` : 'Lista atualizada.');
      await loadData();
    } catch (updateError) { setError(updateError.message); }
  };

  const updateConsent = async (patient, marketing_consent) => {
    try {
      await request(`/patients/${patient.id}/marketing-consent`, {
        method: 'PATCH', body: JSON.stringify({ marketing_consent }),
      });
      setMessage('Preferência de comunicação atualizada.');
      await loadData();
    } catch (updateError) { setError(updateError.message); }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setSavingSettings(true);
    try {
      await request('/clinic/settings', { method: 'PUT', body: JSON.stringify(dashboard.clinic) });
      setMessage('Dados do consultório e horários salvos.');
      await loadData();
    } catch (saveError) { setError(saveError.message); }
    finally { setSavingSettings(false); }
  };

  const uploadClinicLogo = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const response = await fetch(`${API_URL}/clinic/logo`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível enviar o logo.');
      setDashboard((current) => ({ ...current, clinic: { ...current.clinic, logo_url: result.logo_url } }));
      setMessage('Logo do consultório atualizado.');
    } catch (uploadError) { setError(uploadError.message); }
    finally { setLogoUploading(false); event.target.value = ''; }
  };

  const addTeamMember = async (event) => {
    event.preventDefault();
    try {
      await request('/clinic/members', { method: 'POST', body: JSON.stringify(memberForm) });
      setMemberForm({ email: '', role: 'reception' });
      setMessage('Pessoa vinculada à equipe. Ela já precisa ter uma conta AgendaLivre.');
      setTeam(await request('/clinic/members'));
    } catch (memberError) { setError(memberError.message); }
  };

  const removeTeamMember = async (member) => {
    if (!window.confirm(`Remover ${member.name} da equipe do consultório?`)) return;
    try {
      await request(`/clinic/members/${member.id}`, { method: 'DELETE' });
      setTeam((current) => current.filter((entry) => entry.id !== member.id));
      setMessage('Acesso removido.');
    } catch (memberError) { setError(memberError.message); }
  };

  const refreshReactivation = async (days) => {
    setReactivation((current) => ({ ...current, days }));
    try {
      const result = await request(`/premium/reactivation-candidates?days=${days}`);
      setReactivation(result);
      setSelectedPatients(result.patients.filter((patient) => Boolean(Number(patient.marketing_consent))).map((patient) => patient.id));
    } catch (refreshError) { setError(refreshError.message); }
  };

  const toggleRecipient = (patientId) => {
    setSelectedPatients((current) => current.includes(patientId)
      ? current.filter((id) => id !== patientId)
      : [...current, patientId]);
  };

  const sendCampaign = async (event) => {
    event.preventDefault();
    setSendingCampaign(true);
    setError('');
    try {
      const result = await request('/premium/campaigns', {
        method: 'POST',
        body: JSON.stringify({ ...campaign, patient_ids: selectedPatients }),
      });
      setMessage(`Campanha enviada para ${result.sent} pessoa(s). Restam ${result.remaining} envios neste mês.`);
      setSelectedPatients([]);
    } catch (sendError) { setError(sendError.message); }
    finally { setSendingCampaign(false); }
  };

  const startCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const result = await request('/billing/checkout', { method: 'POST' });
      if (!result.url) throw new Error('Checkout ainda não está configurado.');
      window.location.assign(result.url);
    } catch (checkoutError) { setError(checkoutError.message); }
    finally { setCheckoutLoading(false); }
  };

  const manageSubscription = async () => {
    setPortalLoading(true);
    try {
      const result = await request('/billing/portal', { method: 'POST' });
      if (!result.url) throw new Error('O portal de assinatura não está configurado.');
      window.location.assign(result.url);
    } catch (portalError) { setError(portalError.message); }
    finally { setPortalLoading(false); }
  };

  const changeAppointmentStatus = (event, appointment) => {
    const nextStatus = event.target.value;
    if (nextStatus === 'reschedule') editAppointment(appointment);
    else if (nextStatus) updateAppointment(appointment, nextStatus);
    event.target.value = '';
  };

  const startAppointment = () => {
    const now = new Date();
    now.setMinutes(Math.ceil((now.getMinutes() + 1) / 15) * 15, 0, 0);
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    setEditingAppointment(null);
    setAppointmentForm((current) => ({ ...current, start_at: localDate, professional_name: user?.nome || '' }));
    setShowAppointmentForm(true);
  };

  const editAppointment = (appointment) => {
    const start = parseServerDate(appointment.start_at);
    const end = parseServerDate(appointment.end_at);
    const duration = start && end ? Math.round((end - start) / 60_000) : 60;
    setEditingAppointment(appointment);
    setAppointmentForm({
      patient_id: String(appointment.patient_id),
      professional_name: appointment.professional_name,
      start_at: serverDateToLocalInput(appointment.start_at),
      duration_minutes: String([15, 30, 45, 60, 90, 120].includes(duration) ? duration : 60),
    });
    setShowAppointmentForm(true);
  };

  const renderPremiumGate = () => (
    <section className="premium-gate">
      <div className="premium-orb">✦</div>
      <span className="eyebrow">AGENDA LIVRE PRO</span>
      <h2>Mais retornos. Menos horários vazios.</h2>
      <p>Encontre pacientes sem novo horário marcado, organize campanhas autorizadas e acompanhe a ocupação do consultório.</p>
      <div className="premium-perks">
        <span>✓ Lista inteligente de retorno</span>
        <span>✓ Até 200 e-mails autorizados por mês</span>
        <span>✓ Sugestões da lista de espera em cancelamentos</span>
      </div>
      {dashboard?.clinicRole === 'owner' ? <button className="button button-primary" onClick={startCheckout} disabled={checkoutLoading}>
        {checkoutLoading ? 'Abrindo checkout…' : 'Assinar plano Pro'}
      </button> : <p>Peça ao proprietário do consultório para conhecer o plano Pro.</p>}
      <small>Checkout Stripe em modo de teste. A cobrança depende da configuração do ambiente.</small>
    </section>
  );

  const renderAppointments = (items, showActions = true) => (
    <div className="appointment-list">
      {items.length === 0 && <div className="empty-state"><span>☼</span><strong>Nenhum atendimento por aqui</strong><p>Agende um horário ou confira outra data.</p></div>}
      {items.map((appointment) => (
        <article className="appointment-row" key={appointment.id}>
          <div className="appointment-time">
            <strong>{formatDateTime(appointment.start_at, { day: undefined, month: undefined })}</strong>
            <span>{formatDateTime(appointment.start_at, { year: undefined, month: 'short', day: '2-digit' })}</span>
          </div>
          <div className="appointment-person"><span className="avatar-small">{appointment.patient_name?.slice(0, 1).toUpperCase()}</span><div><strong>{appointment.patient_name}</strong><small>Dr(a). {appointment.professional_name}</small></div></div>
          <span className={`status-pill status-${appointment.status}`}>{statusLabels[appointment.status]}</span>
          {showActions && ['scheduled', 'confirmed'].includes(appointment.status) && (
            <select className="status-select" aria-label={`Atualizar atendimento de ${appointment.patient_name}`} defaultValue="" onChange={(event) => changeAppointmentStatus(event, appointment)}>
              <option value="" disabled>Ações</option>
              <option value="reschedule">Remarcar</option>
              {appointment.status === 'scheduled' && <option value="confirmed">Confirmar</option>}
              <option value="completed">Concluir</option><option value="cancelled">Cancelar</option><option value="no_show">Falta</option>
            </select>
          )}
        </article>
      ))}
    </div>
  );

  const renderOverview = () => (
    <>
      <section className="welcome-row">
        <div><span className="eyebrow">{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()).toUpperCase()}</span><h2>Olá, {user?.nome?.split(' ')[0] || 'bem-vindo'} <span>☀</span></h2><p>Veja como está o consultório hoje.</p></div>
        <button className="button button-primary" onClick={startAppointment}><span>＋</span> Novo horário</button>
      </section>
      <section className="metric-grid">
        <article className="metric-card"><span className="metric-icon icon-violet">▦</span><span className="metric-label">Consultas hoje</span><strong>{dashboard?.stats?.today ?? '—'}</strong><small>na agenda de hoje</small></article>
        <article className="metric-card"><span className="metric-icon icon-green">♙</span><span className="metric-label">Pacientes</span><strong>{dashboard?.stats?.patients ?? '—'}</strong><small>cadastros do consultório</small></article>
        <article className="metric-card"><span className="metric-icon icon-orange">◷</span><span className="metric-label">Próximos horários</span><strong>{dashboard?.stats?.upcoming ?? '—'}</strong><small>agendados ou confirmados</small></article>
        <article className="metric-card"><span className="metric-icon icon-blue">✧</span><span className="metric-label">Vagas livres hoje</span><strong>{openSlots ?? '—'}</strong><small>com base no expediente definido</small></article>
      </section>
      {!dashboard?.premium && dashboard?.clinicRole === 'owner' && <div className="plan-usage-note"><span>Plano Free</span><strong>{dashboard?.stats?.appointmentsCreatedThisMonth || 0} de 3 agendamentos usados neste mês</strong><small>O Pro remove a franquia e libera recursos de retorno e campanhas autorizadas.</small></div>}
      <div className="content-grid">
        <section className="panel panel-large"><div className="panel-heading"><div><span className="eyebrow">ACOMPANHAMENTO</span><h3>Agenda de hoje</h3></div><button className="text-button" onClick={() => setActiveSection('calendar')}>Ver agenda <span>→</span></button></div>{renderAppointments(todaysAppointments)}</section>
        <aside className="panel insight-panel"><div className="insight-art">✦</div><span className="eyebrow">UM DIA MAIS LEVE</span><h3>Uma agenda organizada muda tudo.</h3><p>Confirme horários, acompanhe cancelamentos e deixe espaço para quem está esperando.</p><button className="button button-soft" onClick={() => setActiveSection('waitlist')}>Abrir lista de espera <span>→</span></button></aside>
      </div>
      {!dashboard?.premium && dashboard?.clinicRole === 'owner' && <section className="upgrade-banner"><div><span className="eyebrow">AGENDA LIVRE PRO</span><h3>Preencha vagas e facilite o retorno.</h3><p>Ative sugestões de retorno, campanhas com consentimento e lista de espera inteligente.</p></div><button className="button button-dark" onClick={startCheckout}>Conhecer Pro <span>→</span></button></section>}
      {dashboard?.clinicRole === 'owner' && <>
        <section className="panel settings-panel"><div className="panel-heading"><div><span className="eyebrow">PERSONALIZAÇÃO</span><h3>Seu consultório</h3></div><span className="setting-caption">Essas informações aparecem na sua agenda</span></div><form className="settings-form" onSubmit={saveSettings}><label>Nome do consultório<input value={dashboard?.clinic?.name || ''} maxLength="120" onChange={(event) => setDashboard((current) => ({ ...current, clinic: { ...current.clinic, name: event.target.value } }))} required /></label><label>Abre<input type="time" value={dashboard?.clinic?.workday_start || '09:00'} onChange={(event) => setDashboard((current) => ({ ...current, clinic: { ...current.clinic, workday_start: event.target.value } }))} required /></label><label>Fecha<input type="time" value={dashboard?.clinic?.workday_end || '17:00'} onChange={(event) => setDashboard((current) => ({ ...current, clinic: { ...current.clinic, workday_end: event.target.value } }))} required /></label><label>Duração padrão<select value={dashboard?.clinic?.slot_minutes || 60} onChange={(event) => setDashboard((current) => ({ ...current, clinic: { ...current.clinic, slot_minutes: Number(event.target.value) } }))}><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option><option value="90">90 min</option><option value="120">120 min</option></select></label><button className="button button-outline" disabled={savingSettings}>{savingSettings ? 'Salvando…' : 'Salvar'}</button></form><div className="clinic-logo-row">{dashboard?.clinic?.logo_url && <img src={dashboard.clinic.logo_url} alt="Logo do consultório" />}<label className="button button-outline">{logoUploading ? 'Enviando…' : 'Enviar logo (PNG, JPG ou WebP)'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadClinicLogo} disabled={logoUploading} /></label><small>Máximo de 3 MB. A imagem fica no object storage MinIO.</small></div></section>
        <section className="panel settings-panel"><div className="panel-heading"><div><span className="eyebrow">ACESSO À EQUIPE</span><h3>Proprietário, recepção e profissionais</h3></div></div><p className="team-help">Para vincular alguém, essa pessoa precisa criar primeiro uma conta AgendaLivre. A permissão é validada pela API em cada solicitação.</p><form className="settings-form team-form" onSubmit={addTeamMember}><label>E-mail da conta<input type="email" value={memberForm.email} onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })} required /></label><label>Papel<select value={memberForm.role} onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value })}><option value="reception">Recepção</option><option value="professional">Profissional</option></select></label><button className="button button-outline">Vincular</button></form><div className="team-list">{team.map((member) => <article key={member.id}><span className="avatar-small avatar-color">{member.name.slice(0, 1).toUpperCase()}</span><span><strong>{member.name}</strong><small>{member.email} · {member.role === 'owner' ? 'Proprietário' : member.role === 'reception' ? 'Recepção' : 'Profissional'}</small></span>{member.role !== 'owner' && <button className="text-button" onClick={() => removeTeamMember(member)}>Remover</button>}</article>)}</div></section>
      </>}
    </>
  );

  const renderCalendar = () => (
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ROTINA DO CONSULTÓRIO</span><h2>Agenda</h2><p>Gerencie confirmações, cancelamentos e atendimentos.</p></div><button className="button button-primary" onClick={startAppointment}>＋ Novo horário</button></div>{renderAppointments([...appointments].sort((a, b) => parseServerDate(b.start_at) - parseServerDate(a.start_at)))}</section>
  );

  const renderPatients = () => (
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">RELACIONAMENTO</span><h2>Pacientes</h2><p>Cadastre apenas os dados necessários para organizar os agendamentos.</p></div><button className="button button-primary" onClick={() => setShowPatientForm(true)}>＋ Novo paciente</button></div><div className="toolbar"><label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou telefone" /></label><span className="table-count">{visiblePatients.length} cadastro(s)</span></div><div className="patient-list"><div className="patient-list-head"><span>Paciente</span><span>Contato</span><span>Último atendimento</span><span>Comunicações</span></div>{visiblePatients.map((patient) => <article className="patient-row" key={patient.id}><div className="patient-name"><span className="avatar-small avatar-color">{patient.name.slice(0, 1).toUpperCase()}</span><strong>{patient.name}</strong></div><div className="patient-contact"><span>{patient.email || 'Sem e-mail'}</span><small>{patient.phone || 'Sem telefone'}</small></div><span className="patient-last-visit">{patient.last_visit ? formatDateTime(patient.last_visit, { hour: undefined, minute: undefined }) : 'Sem histórico'}</span><label className="consent-toggle"><input type="checkbox" checked={Boolean(Number(patient.marketing_consent))} onChange={(event) => updateConsent(patient, event.target.checked)} /><span>{Number(patient.marketing_consent) ? 'Autorizado' : 'Não autorizado'}</span></label></article>)}{visiblePatients.length === 0 && <div className="empty-state"><span>♙</span><strong>Nenhum paciente cadastrado</strong><p>Adicione o primeiro cadastro para começar a organizar a agenda.</p></div>}</div><p className="privacy-note">A autorização para comunicações é opcional e separada do cadastro. O paciente pode cancelar o recebimento a qualquer momento.</p></section>
  );

  const renderWaitlist = () => (
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">HORÁRIOS MAIS FLEXÍVEIS</span><h2>Lista de espera</h2><p>Organize quem gostaria de ser avisado quando surgir um horário.</p></div><button className="button button-primary" onClick={() => setShowWaitlistForm(true)}>＋ Adicionar pessoa</button></div>{dashboard?.premium && <div className="waitlist-premium-note"><span>✦</span><p><strong>Premium:</strong> ao cancelar uma consulta, mostramos até 10 pessoas desta lista para a equipe avaliar e contatar.</p></div>}{slotSuggestions.length > 0 && dashboard?.premium && <div className="slot-suggestion-panel"><div><span className="eyebrow">VAGA ABERTA</span><strong>Possíveis encaixes para contato</strong><p>Confira a preferência e contate pelo canal autorizado pela pessoa.</p></div>{slotSuggestions.map((candidate) => <article className="slot-suggestion" key={candidate.waitlist_id}><span className="avatar-small avatar-color">{candidate.name.slice(0, 1).toUpperCase()}</span><span><strong>{candidate.name}</strong><small>{candidate.email || candidate.phone || 'Sem contato cadastrado'} · {periodLabels[candidate.preferred_period]}</small></span><button className="text-button" onClick={() => updateWaitlist({ id: candidate.waitlist_id, patient_name: candidate.name }, 'contacted')}>Marcar contato</button></article>)}<button className="text-button clear-suggestions" onClick={() => setSlotSuggestions([])}>Dispensar sugestões</button></div>}<div className="waitlist-list">{waitlist.map((entry) => <article className="waitlist-row" key={entry.id}><span className="avatar-small avatar-color">{entry.patient_name.slice(0, 1).toUpperCase()}</span><div className="waitlist-person"><strong>{entry.patient_name}</strong><small>{entry.email || entry.phone || 'Sem contato cadastrado'}</small></div><span className="preference-chip">{periodLabels[entry.preferred_period]}</span><span className={`status-pill status-${entry.status}`}>{entry.status === 'waiting' ? 'Aguardando' : 'Contatado'}</span><div className="row-actions"><button className="text-button" onClick={() => updateWaitlist(entry, 'contacted')}>Marcar contato</button><button className="icon-button" title="Remover da lista" onClick={() => updateWaitlist(entry, 'removed')}>×</button></div></article>)}{waitlist.length === 0 && <div className="empty-state"><span>↗</span><strong>Lista vazia por enquanto</strong><p>Inclua pacientes que pediram para ser avisados sobre encaixes.</p></div>}</div></section>
  );

  const renderGrowth = () => {
    if (!dashboard?.premium) return renderPremiumGate();
    return <div className="growth-layout"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">SUGESTÕES DA AGENDA</span><h2>Possíveis retornos</h2><p>Lista administrativa para revisão da equipe — não é recomendação clínica.</p></div><label className="days-select">Sem atendimento<select value={reactivation.days} onChange={(event) => refreshReactivation(Number(event.target.value))}><option value="60">Há 60 dias</option><option value="90">Há 90 dias</option><option value="120">Há 120 dias</option><option value="180">Há 180 dias</option></select></label></div><div className="candidate-list">{reactivation.patients?.map((patient) => <label className={`candidate-row ${!Number(patient.marketing_consent) ? 'candidate-disabled' : ''}`} key={patient.id}><input type="checkbox" checked={selectedPatients.includes(patient.id)} disabled={!Number(patient.marketing_consent) || !patient.email} onChange={() => toggleRecipient(patient.id)} /><span className="avatar-small avatar-color">{patient.name.slice(0, 1).toUpperCase()}</span><span className="candidate-info"><strong>{patient.name}</strong><small>{patient.email || 'Sem e-mail'}</small></span><span className="candidate-date">Última visita<br /><strong>{formatDateTime(patient.last_visit, { hour: undefined, minute: undefined })}</strong></span><span className={`consent-badge ${Number(patient.marketing_consent) ? 'consent-yes' : ''}`}>{Number(patient.marketing_consent) ? 'Autorizado' : 'Sem autorização'}</span></label>)}{(!reactivation.patients || reactivation.patients.length === 0) && <div className="empty-state"><span>✧</span><strong>Nenhuma sugestão neste período</strong><p>As sugestões consideram somente histórico de agendamentos e não usam informações clínicas.</p></div>}</div></section><section className="panel campaign-panel"><div className="panel-heading"><div><span className="eyebrow">COMUNICAÇÃO RESPONSÁVEL</span><h3>Nova campanha</h3></div><span className="quota-badge">200 envios/mês</span></div><p className="campaign-description">Apenas pacientes com e-mail e autorização ativa serão incluídos. Todo e-mail terá opção de descadastro.</p><form onSubmit={sendCampaign} className="campaign-form"><label>Assunto<input maxLength="120" required value={campaign.subject} onChange={(event) => setCampaign((current) => ({ ...current, subject: event.target.value }))} /></label><label>Mensagem<textarea maxLength="2000" rows="6" required placeholder="Escreva uma mensagem geral do consultório, sem mencionar tratamento ou condição de saúde." value={campaign.message} onChange={(event) => setCampaign((current) => ({ ...current, message: event.target.value }))} /></label><div className="campaign-footer"><span>{selectedPatients.length} destinatário(s) selecionado(s)</span><button className="button button-primary" disabled={sendingCampaign || selectedPatients.length === 0}>{sendingCampaign ? 'Enviando…' : 'Enviar campanha'}</button></div></form></section></div>;
  };

  const renderModal = () => {
    if (showPatientForm) return <div className="modal-backdrop" onClick={() => setShowPatientForm(false)}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="patient-modal-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowPatientForm(false)} aria-label="Fechar">×</button><span className="eyebrow">NOVO CADASTRO</span><h2 id="patient-modal-title">Adicionar paciente</h2><p>Use somente informações necessárias para organizar os horários.</p><form className="modal-form" onSubmit={createPatient}><label>Nome completo<input autoFocus required maxLength="120" value={patientForm.name} onChange={(event) => setPatientForm({ ...patientForm, name: event.target.value })} /></label><label>E-mail<input type="email" maxLength="190" value={patientForm.email} onChange={(event) => setPatientForm({ ...patientForm, email: event.target.value })} /></label><label>Telefone<input type="tel" maxLength="40" value={patientForm.phone} onChange={(event) => setPatientForm({ ...patientForm, phone: event.target.value })} /></label><label className="checkbox-line"><input type="checkbox" checked={patientForm.marketing_consent} onChange={(event) => setPatientForm({ ...patientForm, marketing_consent: event.target.checked })} /><span>O paciente autorizou receber comunicações gerais por e-mail.</span></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setShowPatientForm(false)}>Cancelar</button><button className="button button-primary">Salvar paciente</button></div></form></section></div>;
    if (showAppointmentForm) return <div className="modal-backdrop" onClick={() => { setShowAppointmentForm(false); setEditingAppointment(null); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="appointment-modal-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => { setShowAppointmentForm(false); setEditingAppointment(null); }} aria-label="Fechar">×</button><span className="eyebrow">{editingAppointment ? 'REMARCAR HORÁRIO' : 'NOVO HORÁRIO'}</span><h2 id="appointment-modal-title">{editingAppointment ? 'Editar atendimento' : 'Agendar atendimento'}</h2><p>Os horários conflitantes do mesmo profissional serão bloqueados.</p>{patients.length === 0 ? <div className="empty-inline">Cadastre um paciente antes de reservar um horário.</div> : <form className="modal-form" onSubmit={createAppointment}><label>Paciente<select required value={appointmentForm.patient_id} onChange={(event) => setAppointmentForm({ ...appointmentForm, patient_id: event.target.value })}><option value="">Selecione um paciente</option>{patients.map((patient) => <option value={patient.id} key={patient.id}>{patient.name}</option>)}</select></label><label>Profissional<input required maxLength="120" value={appointmentForm.professional_name} onChange={(event) => setAppointmentForm({ ...appointmentForm, professional_name: event.target.value })} /></label><label>Data e horário<input type="datetime-local" required value={appointmentForm.start_at} onChange={(event) => setAppointmentForm({ ...appointmentForm, start_at: event.target.value })} /></label><label>Duração<select value={appointmentForm.duration_minutes} onChange={(event) => setAppointmentForm({ ...appointmentForm, duration_minutes: event.target.value })}><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">60 minutos</option><option value="90">90 minutos</option><option value="120">120 minutos</option></select></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => { setShowAppointmentForm(false); setEditingAppointment(null); }}>Cancelar</button><button className="button button-primary">{editingAppointment ? 'Salvar alterações' : 'Reservar horário'}</button></div></form>}</section></div>;
    if (showWaitlistForm) return <div className="modal-backdrop" onClick={() => setShowWaitlistForm(false)}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="waitlist-modal-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowWaitlistForm(false)} aria-label="Fechar">×</button><span className="eyebrow">LISTA DE ESPERA</span><h2 id="waitlist-modal-title">Adicionar pessoa</h2><p>Registre a preferência que o paciente informou à equipe.</p>{patients.length === 0 ? <div className="empty-inline">Cadastre um paciente antes de adicioná-lo.</div> : <form className="modal-form" onSubmit={createWaitlistEntry}><label>Paciente<select required value={waitlistForm.patient_id} onChange={(event) => setWaitlistForm({ ...waitlistForm, patient_id: event.target.value })}><option value="">Selecione</option>{patients.map((patient) => <option value={patient.id} key={patient.id}>{patient.name}</option>)}</select></label><label>Período preferido<select value={waitlistForm.preferred_period} onChange={(event) => setWaitlistForm({ ...waitlistForm, preferred_period: event.target.value })}><option value="any">Qualquer horário</option><option value="morning">Manhã</option><option value="afternoon">Tarde</option><option value="evening">Noite</option></select></label><label>Dia da semana (opcional)<select value={waitlistForm.preferred_weekday} onChange={(event) => setWaitlistForm({ ...waitlistForm, preferred_weekday: event.target.value })}><option value="">Qualquer dia</option><option value="1">Segunda-feira</option><option value="2">Terça-feira</option><option value="3">Quarta-feira</option><option value="4">Quinta-feira</option><option value="5">Sexta-feira</option><option value="6">Sábado</option><option value="0">Domingo</option></select></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setShowWaitlistForm(false)}>Cancelar</button><button className="button button-primary">Adicionar à lista</button></div></form>}</section></div>;
    return null;
  };

  return (
    <div className="workspace-shell">
      <aside className="sidebar">
        <div className="brand"><img className="brand-logo" src={logo} alt="AgendaLivre" /><small>GESTÃO DO CONSULTÓRIO</small></div>
        <div className="sidebar-label">MENU PRINCIPAL</div>
        <nav className="side-nav" aria-label="Navegação principal">{NAV_ITEMS.map((item) => <button key={item.id} className={`nav-item ${activeSection === item.id ? 'is-active' : ''}`} onClick={() => setActiveSection(item.id)}><span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.premium && !dashboard?.premium && <span className="nav-premium">PRO</span>}</button>)}</nav>
        <div className="sidebar-spacer" />
        <div className={`sidebar-plan ${dashboard?.premium ? 'plan-active' : ''}`}><span className="plan-sparkle">✦</span><strong>{dashboard?.premium ? 'Plano Pro ativo' : 'Plano Free'}</strong><p>{dashboard?.premium ? 'Recursos inteligentes liberados.' : 'Até 3 novos agendamentos por mês.'}</p>{dashboard?.clinicRole === 'owner' && !dashboard?.premium && <button onClick={startCheckout}>Conhecer Pro <span>→</span></button>}{dashboard?.clinicRole === 'owner' && dashboard?.premium && <button onClick={manageSubscription} disabled={portalLoading}>{portalLoading ? 'Abrindo portal…' : 'Gerenciar assinatura'} <span>→</span></button>}</div>
        <div className="sidebar-profile"><span className="profile-avatar">{user?.nome?.slice(0, 1).toUpperCase() || 'U'}</span><div className="profile-copy"><strong>{user?.nome || 'Usuário'}</strong><small>{dashboard?.clinic?.name || 'Consultório'}</small></div><button className="logout-button" onClick={onLogout} aria-label="Sair">↗</button></div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="breadcrumb"><span>AgendaLivre</span><span>/</span><strong>{NAV_ITEMS.find((item) => item.id === activeSection)?.label || 'Visão geral'}</strong></div><div className="topbar-actions"><span className={`plan-chip ${dashboard?.premium ? 'chip-pro' : ''}`}>{dashboard?.premium ? '✦ Pro' : 'Free'}</span><button className="topbar-avatar" title={user?.nome}>{user?.nome?.slice(0, 1).toUpperCase() || 'U'}</button></div></header>
        <div className="page-content">
          {(message || error) && <div className={`toast ${error ? 'toast-error' : ''}`} role="status"><span>{error ? '!' : '✓'}</span>{error || message}<button onClick={() => { setError(''); setMessage(''); }} aria-label="Fechar aviso">×</button></div>}
          {loading && !dashboard ? <div className="loading-state"><span className="loading-spinner" />Carregando consultório…</div> : <>
            {activeSection === 'overview' && renderOverview()}
            {activeSection === 'calendar' && renderCalendar()}
            {activeSection === 'patients' && renderPatients()}
            {activeSection === 'waitlist' && renderWaitlist()}
            {activeSection === 'growth' && renderGrowth()}
          </>}
        </div>
      </main>
      {renderModal()}
    </div>
  );
}
