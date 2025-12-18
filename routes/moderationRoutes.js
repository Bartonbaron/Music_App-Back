const express = require("express");
const router = express.Router();

const { authenticateToken, requireAdmin } = require("../middleware/authMiddleware");
const {moderateUser} = require("../controllers/moderationController");

router.patch("/user", authenticateToken, requireAdmin, moderateUser);

module.exports = router;
