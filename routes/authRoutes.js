const express = require('express');
const router = express.Router();

const { registerUser, loginUser, logoutUser, getAllCreators, getAllUsers } = require('../controllers/authController');
const { authenticateToken, requireAdmin} = require('../middleware/authMiddleware');

// Trasy
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', authenticateToken, logoutUser);

router.get('/creators', authenticateToken, requireAdmin, getAllCreators);
router.get('/list', authenticateToken, requireAdmin, getAllUsers);

module.exports = router;
