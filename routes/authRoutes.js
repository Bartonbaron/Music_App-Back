const express = require('express');
const router = express.Router();

const { registerUser, loginUser, protectedRoute, updateProfile, changePassword } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/protected', authenticateToken, protectedRoute);
router.put('/update', authenticateToken, updateProfile);
router.put('/change-password', authenticateToken, changePassword);

module.exports = router;
