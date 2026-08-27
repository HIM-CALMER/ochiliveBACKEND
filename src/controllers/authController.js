const crypto = require('crypto');
const { createToken, sanitizeUser, isValidEmail, isStrongPassword } = require('../utils/auth');
const { findByEmail, findUsersByEmail, countUsersByEmail, findByUsername, createUser, storePendingRegistration, getPendingRegistration, deletePendingRegistration, usernameExists, reserveUsername, releaseUsernameReservation, storePasswordReset, getPasswordReset, deletePasswordReset, updateById } = require('../services/userStore');
const { sendOtpEmail, sendPasswordResetEmail } = require('../services/emailService');
const { getUsernameValidation, normalizeUsername } = require('../utils/usernamePolicy');

const getOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

exports.registerUser = async (req, res) => {
  const { name, email, username, password } = req.body || {};
  const displayName = name?.trim() || username?.trim();

  if (!displayName || !email?.trim() || !username?.trim() || !password?.trim()) {
    return res.status(400).json({ message: 'Please provide your email, username, and password.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = normalizeUsername(username);

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }

  const usernameValidation = getUsernameValidation(normalizedUsername);
  if (!usernameValidation.valid) {
    if (usernameValidation.reason === 'reserved') return res.status(400).json({ message: 'That username is reserved by Ochi Live. Please choose another one.' });
    return res.status(400).json({ message: 'Username must be 3-24 characters using only letters, numbers, and underscores.' });
  }

  if (await usernameExists(normalizedUsername)) {
    return res.status(409).json({ message: 'That username is already taken.' });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({ message: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.' });
  }

  const accountCount = await countUsersByEmail(normalizedEmail);

  if (accountCount >= 2) {
    return res.status(409).json({ message: 'This email has reached the two-account limit. Please use another email.' });
  }

  const otp = getOtp();
  const pending = {
    id: `pending_${Date.now()}`,
    name: displayName,
    email: normalizedEmail,
    username: normalizedUsername,
    password: password.trim(),
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };

  if (!await reserveUsername(normalizedUsername, normalizedEmail, pending.expiresAt)) {
    return res.status(409).json({ message: 'That username was just taken. Please choose another one.' });
  }

  await storePendingRegistration(normalizedEmail, pending);

  try {
    await sendOtpEmail(normalizedEmail, otp);
  } catch (error) {
    console.error(error.message);
    return res.status(200).json({
      message: 'Verification email delivery is delayed, but your signup is ready. Please use the verification code below to continue.',
      pending: true,
      email: normalizedEmail,
      otp,
      emailDeliveryFailed: true,
    });
  }

  return res.status(200).json({
    message: 'Verification code sent. Please confirm the code to finish creating your account.',
    pending: true,
    email: normalizedEmail,
    otp,
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
    await releaseUsernameReservation(pending.username, normalizedEmail);
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
    username: pending.username,
    password: pending.password,
    profilePictureUrl: '',
    bio: '',
    accountType: 'creator',
    comedyProfile: {},
    followerIds: [],
    followingIds: [],
  };

  try {
    await createUser(newUser);
  } catch (error) {
    await releaseUsernameReservation(pending.username, normalizedEmail);
    if (error.code === 11000) return res.status(409).json({ message: 'That username was taken while you were verifying your email. Please choose another one.' });
    return res.status(500).json({ message: 'Unable to create your account.' });
  }
  await releaseUsernameReservation(pending.username, normalizedEmail);
  await deletePendingRegistration(normalizedEmail);

  res.status(201).json({
    message: 'Account created successfully.',
    token: createToken(newUser),
    user: sanitizeUser(newUser),
  });
};

exports.checkUsernameAvailability = async (req, res) => {
  const validation = getUsernameValidation(req.query?.username);
  if (!validation.normalized) return res.json({ username: '', available: false, reason: 'required', suggestions: [] });
  if (!validation.valid) return res.json({ username: validation.normalized, available: false, reason: validation.reason, suggestions: [] });

  const available = !(await usernameExists(validation.normalized));
  const suggestions = available ? [] : await buildUsernameSuggestions(validation.normalized);
  return res.json({ username: validation.normalized, available, reason: available ? null : 'taken', suggestions });
};

exports.requestPasswordReset = async (req, res) => {
  const normalizedEmail = String(req.body?.email || '').toLowerCase().trim();
  const normalizedUsername = normalizeUsername(req.body?.username);
  const response = { message: 'If an account matches those details, a password reset code has been sent.' };
  if (!isValidEmail(normalizedEmail) || !getUsernameValidation(normalizedUsername).valid) return res.json(response);

  const user = (await findUsersByEmail(normalizedEmail)).find((candidate) => candidate.username === normalizedUsername);
  if (!user) return res.json(response);

  const code = getOtp();
  const resetKey = `${normalizedEmail}:${normalizedUsername}`;
  await storePasswordReset(resetKey, { codeHash: hashCode(code), expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 });
  try {
    await sendPasswordResetEmail(normalizedEmail, code);
  } catch (error) {
    console.error(error.message);
  }
  return res.json(response);
};

exports.resetPassword = async (req, res) => {
  const normalizedEmail = String(req.body?.email || '').toLowerCase().trim();
  const normalizedUsername = normalizeUsername(req.body?.username);
  const code = String(req.body?.code || '').trim();
  const password = String(req.body?.password || '').trim();
  if (!isValidEmail(normalizedEmail) || !getUsernameValidation(normalizedUsername).valid || !/^\d{6}$/.test(code) || !isStrongPassword(password)) {
    return res.status(400).json({ message: 'Enter a valid email, six-digit code, and strong new password.' });
  }

  const resetKey = `${normalizedEmail}:${normalizedUsername}`;
  const reset = await getPasswordReset(resetKey);
  if (!reset || reset.expiresAt < Date.now() || reset.attempts >= 5 || reset.codeHash !== hashCode(code)) {
    if (reset) await storePasswordReset(resetKey, { ...reset, attempts: (reset.attempts || 0) + 1 });
    return res.status(400).json({ message: 'That reset code is invalid or expired. Please request a new code.' });
  }

  const user = (await findUsersByEmail(normalizedEmail)).find((candidate) => candidate.username === normalizedUsername);
  if (!user) return res.status(400).json({ message: 'That reset code is invalid or expired. Please request a new code.' });
  const updated = await updateById(user.id, { password });
  if (!updated) return res.status(500).json({ message: 'Unable to update your password right now.' });
  await deletePasswordReset(resetKey);
  return res.json({ message: `Your @${normalizedUsername} password has been updated. You can now log in.`, username: normalizedUsername });
};

const buildUsernameSuggestions = async (username) => {
  const candidates = [
    `${username}_live`,
    `${username}_comedy`,
    `${username}tv`,
    `the_${username}`,
  ].filter((candidate) => candidate.length <= 24);
  const suggestions = [];
  for (const candidate of candidates) {
    if (getUsernameValidation(candidate).valid && !(await usernameExists(candidate))) suggestions.push(candidate);
    if (suggestions.length === 3) break;
  }
  return suggestions;
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
  const { email, username, identity, password } = req.body || {};
  const loginIdentity = identity || email || username;

  if (!loginIdentity?.trim() || !password?.trim()) {
    return res.status(400).json({ message: 'Please provide your email or username and password.' });
  }

  const normalizedIdentity = loginIdentity.toLowerCase().trim();
  const isEmail = normalizedIdentity.includes('@');
  const matchingUsers = isEmail
    ? await findUsersByEmail(normalizedIdentity)
    : [await findByUsername(normalizedIdentity)].filter(Boolean);
  const existingUser = matchingUsers.find((user) => user.password === password.trim());

  if (!existingUser || existingUser.password !== password.trim()) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  res.status(200).json({
    message: 'Login successful.',
    token: createToken(existingUser),
    user: sanitizeUser(existingUser),
  });
};
