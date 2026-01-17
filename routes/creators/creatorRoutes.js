const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../../middleware/auth/authMiddleware");
const { requireCreator } = require("../../middleware/auth/authMiddleware");
const {getCreatorProfile, getMyCreatorProfile, updateMyCreatorProfile,
    updateCreatorProfile, toggleFollowCreator, getMyFollowersStats} = require("../../controllers/creators/creatorController");

router.get("/me", authenticateToken, requireCreator, getMyCreatorProfile);

router.patch("/me", authenticateToken, requireCreator, updateMyCreatorProfile);

router.get("/me/followers/stats", authenticateToken, requireCreator, getMyFollowersStats);

router.get("/:id", authenticateToken, getCreatorProfile);

router.patch("/:id", authenticateToken, requireCreator, updateCreatorProfile);

router.post("/:id/toggle-follow", authenticateToken, toggleFollowCreator);

module.exports = router;
