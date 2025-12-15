const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middleware/authMiddleware");
const {getCreatorProfile, updateCreatorProfile, followCreator, unfollowCreator} = require("../controllers/creatorController");

router.get("/:id", authenticateToken, getCreatorProfile);

router.patch("/:id", authenticateToken, updateCreatorProfile);

router.post("/:id/follow", authenticateToken, followCreator);
router.post("/:id/unfollow", authenticateToken, unfollowCreator);

module.exports = router;
