const express = require("express");
const router = express.Router();

const { authenticateToken, requireAdmin } = require("../../middleware/auth/authMiddleware");
const { moderateUser } = require("../../controllers/admin/moderationController");

router.patch("/moderation/user", authenticateToken, requireAdmin, moderateUser);

module.exports = router;
