const router = require("express").Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const { getFeed } = require("../controllers/feedController");

router.get("/", authenticateToken, getFeed);

module.exports = router;
