const express = require("express");
const router = express.Router();

const { authenticateToken, requireAdmin } = require("../../middleware/auth/authMiddleware");
const { getAdminStats } = require("../../controllers/admin/adminStatsController");

router.get("/stats", authenticateToken, requireAdmin, getAdminStats);

module.exports = router;
