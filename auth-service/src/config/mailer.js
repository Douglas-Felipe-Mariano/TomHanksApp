const nodemailer = require('nodemailer');

const port = Number(process.env.SMTP_PORT || 587);
const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure,
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

module.exports = transporter;