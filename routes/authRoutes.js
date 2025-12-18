const express = require('express');
const router = express.Router();

const { registerUser, loginUser, updateProfile, changePassword, deactivateOwnAccount, getProfile, promoteToCreator, demoteCreator, getAllCreators, getAllUsers } = require('../controllers/authController');
const { authenticateToken, requireAdmin} = require('../middleware/authMiddleware');


// Trasy
router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/profile', authenticateToken, getProfile);
router.get('/creators', authenticateToken, requireAdmin, getAllCreators);
router.get('/list', authenticateToken, requireAdmin, getAllUsers);
router.get("/me", authenticateToken, (req, res) => {res.json({ user: req.user });});

router.put('/update', authenticateToken, updateProfile);
router.put('/change-password', authenticateToken, changePassword);
router.put('/deactivate', authenticateToken, deactivateOwnAccount);
router.patch('/promote/:id', authenticateToken, requireAdmin, promoteToCreator);
router.patch('/demote/:id', authenticateToken, requireAdmin, demoteCreator);

module.exports = router;
