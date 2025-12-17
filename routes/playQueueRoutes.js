const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middleware/authMiddleware");
const {getQueue, addToQueue, removeFromQueue, clearQueue, reorderQueue} = require("../controllers/playQueueController");

router.get("/", authenticateToken, getQueue);

router.post("/", authenticateToken, addToQueue);

router.patch("/reorder", authenticateToken, reorderQueue);

router.delete("/", authenticateToken, clearQueue);
router.delete("/:id", authenticateToken, removeFromQueue);

module.exports = router;
