const express = require('express');
const router = express.Router();
const { loginUser, registerUser, getMe, logoutUser, seedDatabase, refreshAccessToken } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/register', registerUser); // Seeding/Admin usage
router.get('/seed', seedDatabase); // Auto-fix for empty DB
router.get('/me', protect, getMe);
router.post('/refresh', refreshAccessToken);

module.exports = router;
