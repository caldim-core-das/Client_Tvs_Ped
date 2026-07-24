const express = require('express');
const router = express.Router();
const { loginUser, registerUser, getMe, logoutUser, seedDatabase, refreshAccessToken, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/register', registerUser); // Seeding/Admin usage
router.get('/seed', seedDatabase); // Auto-fix for empty DB
router.get('/me', protect, getMe);
router.post('/refresh', refreshAccessToken);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

module.exports = router;
