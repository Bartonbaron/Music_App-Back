const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../../middleware/auth/authMiddleware");
const { getMyProfile, getPublicUser, updateProfile, changePassword,
    updatePlaybackPreferences, deactivateOwnAccount, getPublicUserPlaylists } = require("../../controllers/users/usersController");

router.get("/me", authenticateToken, getMyProfile);
router.patch("/me", authenticateToken, updateProfile);
router.patch("/password", authenticateToken, changePassword);
router.patch("/preferences", authenticateToken, updatePlaybackPreferences);
router.patch("/me/deactivate", authenticateToken, deactivateOwnAccount);

router.get("/:userID/public", authenticateToken, getPublicUser);
router.get("/:userID/public-playlists", authenticateToken, getPublicUserPlaylists);

module.exports = router;
