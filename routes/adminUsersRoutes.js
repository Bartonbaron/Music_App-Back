const express = require("express");
const router = express.Router();

const { authenticateToken, requireAdmin } = require("../middleware/authMiddleware");
const { getAdminUsers, getAdminUser } = require("../controllers/adminUsersController");

router.get("/users", authenticateToken, requireAdmin, getAdminUsers);
router.get("/users/:id", authenticateToken, requireAdmin, getAdminUser);

module.exports = router;
