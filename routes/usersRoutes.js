const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middleware/authMiddleware");
const { updatePlaybackPreferences } = require("../controllers/usersController");

router.patch("/preferences", authenticateToken, updatePlaybackPreferences);

module.exports = router;
