const express = require('express');
const { registerUser, loginUser, verifyOtp, sendTestEmail } = require('../controllers/authController');
const authenticate = require('../middleware/authGuard');
const dashboardRoutes = require('./dashboardRoutes');
const videoRoutes = require('./videoRoutes');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Backend API root' });
});

router.post('/auth/register', registerUser);
router.post('/auth/verify', verifyOtp);
router.post('/auth/test-email', sendTestEmail);
router.post('/auth/login', loginUser);
router.get('/profile', authenticate, (req, res) => {
  res.json({ message: 'Protected profile route reached.', user: req.user });
});

router.use('/dashboard', dashboardRoutes);
router.use('/videos', videoRoutes);

module.exports = router;
