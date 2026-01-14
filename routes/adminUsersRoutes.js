const express = require("express");
const router = express.Router();

const { authenticateToken, requireAdmin } = require("../middleware/authMiddleware");
const { getAdminUsers, getAdminUser, promoteToCreator, demoteCreator } = require("../controllers/adminUsersController");

router.get("/users", authenticateToken, requireAdmin, getAdminUsers);
router.get("/users/:id", authenticateToken, requireAdmin, getAdminUser);

router.patch('/promote/:id', authenticateToken, requireAdmin, promoteToCreator);
router.patch('/demote/:id', authenticateToken, requireAdmin, demoteCreator);

module.exports = router;
