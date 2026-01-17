const router = require("express").Router();
const { authenticateToken } = require("../../middleware/auth/authMiddleware");
const { getFeed } = require("../../controllers/social/feedController");

router.get("/", authenticateToken, getFeed);

module.exports = router;
