const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const { getHomeFacts } = require("../controllers/homeController");

router.get("/facts", authenticateToken, getHomeFacts);

module.exports = router;