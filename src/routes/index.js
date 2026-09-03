const express = require('express');
const { registerUser, loginUser, verifyOtp, sendTestEmail, checkUsernameAvailability, requestPasswordReset, resetPassword } = require('../controllers/authController');
const authenticate = require('../middleware/authGuard');
const dashboardRoutes = require('./dashboardRoutes');
const videoRoutes = require('./videoRoutes');
const messageRoutes = require('./messageRoutes');
const profileController = require('../controllers/profileController');
const profilePictureUpload = require('multer')({ dest: require('path').join(__dirname, '../uploads') });
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Backend API root' });
});

router.post('/auth/register', registerUser);
router.get('/auth/username-availability', checkUsernameAvailability);
router.post('/auth/forgot-password', requestPasswordReset);
router.post('/auth/reset-password', resetPassword);
router.post('/auth/verify', verifyOtp);
router.post('/auth/test-email', sendTestEmail);
router.post('/auth/login', loginUser);
router.get('/profile', authenticate, (req, res) => {
  res.json({ message: 'Protected profile route reached.', user: req.user });
});

router.use('/dashboard', dashboardRoutes);
router.use('/videos', videoRoutes);
router.use('/messages', messageRoutes);
router.get('/search/profiles', authenticate, profileController.searchProfiles);
router.get('/profiles/:username', authenticate, profileController.getProfile);
router.get('/profiles/:username/posts', authenticate, profileController.getPosts);
router.get('/profiles/:username/reshares', authenticate, profileController.getReshares);
router.patch('/profile/me', authenticate, profileController.updateProfile);
router.post('/profile/me/picture', authenticate, profilePictureUpload.single('picture'), profileController.updateProfilePicture);
router.post('/profile/me/comedy-onboarding', authenticate, profileController.completeComedyOnboarding);
router.post('/profiles/:username/follow', authenticate, profileController.followProfile);
router.delete('/profiles/:username/follow', authenticate, profileController.unfollowProfile);

module.exports = router;
