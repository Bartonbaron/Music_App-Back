const express = require('express');
const router = express.Router();

const { registerUser, loginUser, protectedRoute, updateProfile, changePassword, deactivateAccount, reactivateAccount, getProfile, promoteToCreator, demoteCreator, getAllCreators, getAllUsers } = require('../controllers/authController');
const { authenticateToken, requireAdmin} = require('../middleware/authMiddleware');


// Trasy
router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/protected', authenticateToken, protectedRoute);
router.get('/profile', authenticateToken, getProfile);
router.get('/creators', authenticateToken, requireAdmin, getAllCreators);
router.get('/list', authenticateToken, requireAdmin, getAllUsers);
router.get("/me", authenticateToken, (req, res) => {res.json({ user: req.user });});


router.put('/update', authenticateToken, updateProfile);
router.put('/change-password', authenticateToken, changePassword);
router.put('/deactivate/:id', authenticateToken, requireAdmin, deactivateAccount);
router.put('/reactivate/:id', authenticateToken, requireAdmin, reactivateAccount);
router.put('/promote/:id', authenticateToken, requireAdmin, promoteToCreator);
router.put('/demote/:id', authenticateToken, requireAdmin, demoteCreator);

module.exports = router;
