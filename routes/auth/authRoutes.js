const express = require('express');
const router = express.Router();

const { registerUser, loginUser, logoutUser } = require('../../controllers/auth/authController');
const { authenticateToken } = require('../../middleware/auth/authMiddleware');

// Trasy
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', authenticateToken, logoutUser);

module.exports = router;
