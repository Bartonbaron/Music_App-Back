const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../../middleware/auth/authMiddleware");
const uploadAvatarM = require("../../middleware/upload/uploadAvatar");
const {uploadAvatar, deleteAvatar} = require("../../controllers/users/userAvatarController");

router.post("/", authenticateToken, uploadAvatarM.single("avatar"), uploadAvatar);

router.delete("/", authenticateToken, deleteAvatar);

module.exports = router;

