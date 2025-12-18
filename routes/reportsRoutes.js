const express = require("express");
const router = express.Router();
const {models} = require("../models");

const { authenticateToken } = require("../middleware/authMiddleware");
const { createReport } = require("../controllers/reportsController");

router.post("/", authenticateToken, createReport);

module.exports = router;