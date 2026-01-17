const express = require("express");
const router = express.Router();

const {authenticateToken, requireAdmin} = require("../../middleware/auth/authMiddleware");

const {getReport, getReports, updateReportStatus, handleReport} = require("../../controllers/admin/adminReportsController");

router.get("/reports", authenticateToken, requireAdmin, getReports);
router.get("/reports/:id", authenticateToken, requireAdmin, getReport);

router.patch("/reports/:id", authenticateToken, requireAdmin, updateReportStatus);
router.patch("/reports/:id/action", authenticateToken, requireAdmin, handleReport);

module.exports = router;