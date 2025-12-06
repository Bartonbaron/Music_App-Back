const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middleware/authMiddleware");
const uploadAvatar = require("../middleware/uploadAvatar");
const avatarCtrl = require("../controllers/userAvatarController");

router.post("/users/avatar", authenticateToken, uploadAvatar.single("avatar"), avatarCtrl.uploadAvatar);

router.delete("/users/avatar", authenticateToken, avatarCtrl.deleteAvatar);

module.exports = router;

