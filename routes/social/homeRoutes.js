const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth/authMiddleware");
const { getHomeFacts } = require("../../controllers/social/homeController");

router.get("/facts", authenticateToken, getHomeFacts);

module.exports = router;