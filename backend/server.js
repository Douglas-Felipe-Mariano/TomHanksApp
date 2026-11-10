require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const authMiddleware = require('./src/middlewares/auth');
const billingController = require('./src/controllers/billingController');
const migratePremium = require('./src/scripts/migratePremium');
const clinicController = require('./src/controllers/clinicController');
const migrateClinic = require('./src/scripts/migrateClinic');
const clinicAccess = require('./src/middlewares/clinicAccess');
const requireClinicRole = require('./src/middlewares/requireClinicRole');

const app = express();
app.use(cors());

// O Stripe exige o corpo original para validar a assinatura do webhook.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingController.handleWebhook);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

const forwardAuthRequest = async (req, res) => {
  try {
    const upstreamPath = `/auth${req.url}`;
    const response = await axios({
      method: req.method,
      url: `${authServiceUrl}${upstreamPath}`,
      data: req.body,
      headers: {
        authorization: req.headers.authorization,
      },
      validateStatus: () => true,
    });

    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Erro ao encaminhar requisição de autenticação:', error.message);
    return res.status(503).json({ error: 'Serviço de autenticação indisponível' });
  }
};

// Rotas públicas de autenticação, encaminhadas para o microsserviço interno
app.use('/api/auth', forwardAuthRequest);
app.get('/api/public/unsubscribe', clinicController.unsubscribe);
app.post('/api/public/unsubscribe', clinicController.unsubscribe);

// Rotas protegidas
app.use('/api', authMiddleware);

app.use('/api/clinic', clinicAccess);
app.get('/api/clinic/dashboard', clinicController.getDashboard);
app.put('/api/clinic/settings', requireClinicRole('owner'), clinicController.updateClinicSettings);
app.post('/api/clinic/logo', requireClinicRole('owner'), clinicController.uploadClinicLogo);
app.get('/api/clinic/members', requireClinicRole('owner'), clinicController.listClinicMembers);
app.post('/api/clinic/members', requireClinicRole('owner'), clinicController.addClinicMember);
app.delete('/api/clinic/members/:userId', requireClinicRole('owner'), clinicController.removeClinicMember);

app.use('/api/patients', clinicAccess);
app.get('/api/patients', clinicController.listPatients);
app.post('/api/patients', requireClinicRole('owner', 'reception'), clinicController.createPatient);
app.patch('/api/patients/:id/marketing-consent', requireClinicRole('owner', 'reception'), clinicController.updatePatientConsent);

app.use('/api/appointments', clinicAccess);
app.get('/api/appointments', clinicController.listAppointments);
app.get('/api/appointments/:id', clinicController.getAppointment);
app.post('/api/appointments', clinicController.createAppointment);
app.put('/api/appointments/:id', clinicController.updateAppointment);
app.delete('/api/appointments/:id', clinicController.deleteAppointment);
app.patch('/api/appointments/:id/status', clinicController.updateAppointmentStatus);

app.use('/api/waitlist', clinicAccess);
app.get('/api/waitlist', clinicController.listWaitlist);
app.post('/api/waitlist', requireClinicRole('owner', 'reception'), clinicController.addToWaitlist);
app.patch('/api/waitlist/:id/status', requireClinicRole('owner', 'reception'), clinicController.updateWaitlistStatus);

app.use('/api/premium', clinicAccess);
app.get('/api/premium/reactivation-candidates', clinicController.listReactivationCandidates);
app.post('/api/premium/campaigns', requireClinicRole('owner'), clinicController.sendCampaign);

app.use('/api/billing', clinicAccess);
app.post('/api/billing/checkout', requireClinicRole('owner'), billingController.createCheckoutSession);
app.get('/api/billing/status', requireClinicRole('owner'), billingController.getPremiumStatus);
app.post('/api/billing/cancel', requireClinicRole('owner'), billingController.cancelPremiumSubscription);
app.post('/api/billing/portal', requireClinicRole('owner'), billingController.createPortalSession);

const logger = require('./src/utils/logger');
const logServiceUrl = process.env.LOG_SERVICE_URL || 'http://log-service:3002';

app.get('/api/admin/logs', async (req, res) => {
  if (req.userRole !== 'admin') {
    logger.logEvent(req.userId, 'tentativa_negada_403_ver_logs');
    return res.status(403).json({ error: 'Proibido: Apenas administradores podem ver os logs' });
  }

  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 50;
    const response = await axios.get(`${logServiceUrl}/logs`, { params: { limit } });
    res.json(response.data);
  } catch (error) {
    console.error('Erro ao buscar logs do log-service:', error.message);
    res.status(500).json({ error: 'Erro ao consultar log de auditoria' });
  }
});

app.get('/api/admin/billing/summary', (req, res, next) => {
  if (req.userRole !== 'admin') {
    logger.logEvent(req.userId, 'tentativa_negada_403_metricas_billing');
    return res.status(403).json({ error: 'Apenas administradores podem consultar métricas de cobrança.' });
  }
  return next();
}, billingController.getAdminBillingSummary);

const { initMinio } = require('./src/config/minio');
const path = require('path');

// Serve o frontend estático se estiver no Docker/Produção
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Redireciona qualquer rota não API para o index.html do React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await initMinio();
  await migratePremium();
  await migrateClinic();
  
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();
