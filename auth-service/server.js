require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authController = require('./src/controllers/authController');
const authMiddleware = require('./src/middlewares/auth');
const migrateDatabase = require('./src/scripts/migrate');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/auth/register', authController.register);
app.post('/auth/login', authController.login);
app.post('/auth/forgot-password', authController.forgotPassword);
app.get('/auth/reset-password/validate', authController.validateResetToken);
app.post('/auth/reset-password', authController.resetPassword);
app.get('/auth/me', authMiddleware, authController.me);

const PORT = process.env.PORT || 3001;

const start = async () => {
  await migrateDatabase();

  app.listen(PORT, () => {
    console.log(`Auth service running on port ${PORT}`);
  });
};

start().catch((error) => {
  console.error('Falha ao iniciar auth-service:', error);
  process.exit(1);
});