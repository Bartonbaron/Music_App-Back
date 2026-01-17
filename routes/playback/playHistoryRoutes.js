const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../../middleware/auth/authMiddleware");
const {getHistory, addToHistory, clearHistory} = require("../../controllers/playback/playHistoryController");

router.get("/", authenticateToken, getHistory);

router.post("/", authenticateToken, addToHistory);

router.delete("/", authenticateToken, clearHistory);

module.exports = router;
