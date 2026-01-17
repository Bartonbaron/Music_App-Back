const express = require("express");
const router = express.Router();
const {models} = require("../../models");

const { authenticateToken } = require("../../middleware/auth/authMiddleware");
const { createReport } = require("../../controllers/social/reportsController");

router.post("/", authenticateToken, createReport);

module.exports = router;