const { createToken, sanitizeUser, isValidEmail, isStrongPassword } = require('../utils/auth');
const { findByEmail, createUser, storePendingRegistration, getPendingRegistration, deletePendingRegistration } = require('../services/userStore');
const { sendOtpEmail } = require('../services/emailService');

const getOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.registerUser = async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return res.status(400).json({ message: 'Please provide your name, email, and password.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({ message: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.' });
  }

  const existingUser = await findByEmail(normalizedEmail);

  if (existingUser) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const otp = getOtp();
  const pending = {
    id: `pending_${Date.now()}`,
    name: name.trim(),
    email: normalizedEmail,
    password: password.trim(),
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };

  try {
    await sendOtpEmail(normalizedEmail, otp);
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      message: 'Unable to send the verification email right now. Please configure SMTP settings for real email delivery.',
    });
  }

  await storePendingRegistration(normalizedEmail, pending);

  return res.status(200).json({
    message: 'Verification code sent. Please confirm the code to finish creating your account.',
    pending: true,
    email: normalizedEmail,
  });
};

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body || {};

  if (!email?.trim() || !otp?.trim()) {
    return res.status(400).json({ message: 'Please provide your email and verification code.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const pending = await getPendingRegistration(normalizedEmail);

  if (!pending) {
    return res.status(404).json({ message: 'No pending verification found for this email.' });
  }

  if (pending.expiresAt < Date.now()) {
    await deletePendingRegistration(normalizedEmail);
    return res.status(410).json({ message: 'Verification code expired. Please request a new one.' });
  }

  if (pending.otp !== otp.trim()) {
    return res.status(401).json({ message: 'The verification code is incorrect.' });
  }

  const newUser = {
    id: `user_${Date.now()}`,
    name: pending.name,
    email: pending.email,
    password: pending.password,
  };

  await createUser(newUser);
  await deletePendingRegistration(normalizedEmail);

  res.status(201).json({
    message: 'Account created successfully.',
    token: createToken(newUser),
    user: sanitizeUser(newUser),
  });
};

exports.sendTestEmail = async (req, res) => {
  const { email } = req.body || {};

  if (!email?.trim()) {
    return res.status(400).json({ message: 'Please provide an email address.' });
  }

  try {
    await sendOtpEmail(email.toLowerCase().trim(), '123456');
    return res.status(200).json({ message: 'Test email sent successfully.' });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: 'Test email could not be sent.', details: error.message });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body || {};

  if (!email?.trim() || !password?.trim()) {
    return res.status(400).json({ message: 'Please provide your email and password.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await findByEmail(normalizedEmail);

  if (!existingUser || existingUser.password !== password.trim()) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  res.status(200).json({
    message: 'Login successful.',
    token: createToken(existingUser),
    user: sanitizeUser(existingUser),
  });
};
