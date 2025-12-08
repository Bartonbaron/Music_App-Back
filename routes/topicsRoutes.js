const express = require("express");
const router = express.Router();

const { authenticateToken, requireAdmin } = require("../middleware/authMiddleware");

const {getAllTopics, getTopic, createTopic, updateTopic, deleteTopic} = require("../controllers/topicsController");

router.get("/", authenticateToken, getAllTopics);
router.get("/:id", authenticateToken, getTopic);

router.post("/", authenticateToken, requireAdmin, createTopic);
router.patch("/:id", authenticateToken, requireAdmin, updateTopic);
router.delete("/:id", authenticateToken, requireAdmin, deleteTopic);

module.exports = router;
