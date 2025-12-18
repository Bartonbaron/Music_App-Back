const express = require("express");
const router = express.Router();

const { authenticateToken, requireAdmin } = require("../middleware/authMiddleware");
const { getAdminStats } = require("../controllers/adminStatsController");

router.get("/stats", authenticateToken, requireAdmin, getAdminStats);

module.exports = router;
