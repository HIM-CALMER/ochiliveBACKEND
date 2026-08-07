require('dotenv').config();
const nodemailer = require('nodemailer');

let transporter = null;

const ensureTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (process.env.SMTP_HOST === 'test') {
    return null;
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP credentials are not configured. Set SMTP_USER and SMTP_PASS in the backend environment.');
  }

  const isGmail = process.env.SMTP_HOST === 'smtp.gmail.com' || process.env.SMTP_SERVICE === 'gmail';

  transporter = nodemailer.createTransport(
    isGmail
      ? {
          service: 'gmail',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        }
      : {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        }
  );

  return transporter;
};

const sendOtpEmail = async (to, otp) => {
  const message = `Your Ochi Live verification code is ${otp}. It expires in 10 minutes.`;
  const mailTransport = ensureTransporter();

  if (!mailTransport) {
    throw new Error('SMTP transport is not configured.');
  }

  try {
    await mailTransport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Your Ochi Live verification code',
      text: message,
      html: `<p>Your Ochi Live verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });

    return { ok: true, mode: 'smtp' };
  } catch (error) {
    throw new Error(`Unable to send OTP email: ${error.message}`);
  }
};

module.exports = {
  sendOtpEmail,
};
