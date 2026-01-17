const express = require("express");
const router = express.Router();

const { authenticateToken, requireAdmin } = require("../../middleware/auth/authMiddleware");

const {getAllTopics, getTopic, createTopic, updateTopic, deleteTopic} = require("../../controllers/content/topicsController");

router.get("/", authenticateToken, getAllTopics);
router.post("/", authenticateToken, requireAdmin, createTopic);

router.get("/:id", authenticateToken, getTopic);
router.patch("/:id", authenticateToken, requireAdmin, updateTopic);
router.delete("/:id", authenticateToken, requireAdmin, deleteTopic);

module.exports = router;
