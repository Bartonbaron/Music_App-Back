const express = require('express');
const router = express.Router();

const { registerUser, loginUser, logoutUser, deactivateOwnAccount,
    promoteToCreator, demoteCreator, getAllCreators, getAllUsers } = require('../controllers/authController');
const { authenticateToken, requireAdmin} = require('../middleware/authMiddleware');

// Trasy
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', authenticateToken, logoutUser);

router.get('/creators', authenticateToken, requireAdmin, getAllCreators);
router.get('/list', authenticateToken, requireAdmin, getAllUsers);

router.put('/deactivate', authenticateToken, deactivateOwnAccount);
router.patch('/promote/:id', authenticateToken, requireAdmin, promoteToCreator);
router.patch('/demote/:id', authenticateToken, requireAdmin, demoteCreator);

module.exports = router;
