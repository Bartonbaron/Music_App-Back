const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middleware/authMiddleware");
const creatorCtrl = require("../controllers/creatorController");

router.get("/:id", creatorCtrl.getCreatorProfile);

router.patch("/:id", authenticateToken, creatorCtrl.updateCreatorProfile);

router.post("/:id/follow", authenticateToken, creatorCtrl.followCreator);
router.post("/:id/unfollow", authenticateToken, creatorCtrl.unfollowCreator);

module.exports = router;
