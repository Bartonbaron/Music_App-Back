const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middleware/authMiddleware");
const creatorCtrl = require("../controllers/creatorController");

router.get("/creator/:id", creatorCtrl.getCreatorProfile);

router.patch("/creator/:id", authenticateToken, creatorCtrl.updateCreatorProfile);

router.post("/creator/:id/follow", authenticateToken, creatorCtrl.followCreator);
router.post("/creator/:id/unfollow", authenticateToken, creatorCtrl.unfollowCreator);

module.exports = router;
