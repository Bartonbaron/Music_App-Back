const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middleware/authMiddleware");
const {getCreatorProfile, getMyCreatorProfile,
    updateMyCreatorProfile, updateCreatorProfile, toggleFollowCreator} = require("../controllers/creatorController");

router.get("/me", authenticateToken, getMyCreatorProfile);

router.patch("/me", authenticateToken, updateMyCreatorProfile);

router.get("/:id", authenticateToken, getCreatorProfile);

router.patch("/:id", authenticateToken, updateCreatorProfile);

router.post("/:id/toggle-follow", authenticateToken, toggleFollowCreator);

module.exports = router;
