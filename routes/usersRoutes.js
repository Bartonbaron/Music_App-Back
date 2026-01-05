const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middleware/authMiddleware");
const { getMyProfile, getPublicUser, updateProfile, changePassword,
    updatePlaybackPreferences, getPublicUserPlaylists } = require("../controllers/usersController");

router.get("/me", authenticateToken, getMyProfile);
router.get("/:userID/public", authenticateToken, getPublicUser);
router.get("/:userID/public-playlists", authenticateToken, getPublicUserPlaylists);

router.patch("/me", authenticateToken, updateProfile);
router.patch("/password", authenticateToken, changePassword);
router.patch("/preferences", authenticateToken, updatePlaybackPreferences);

module.exports = router;
