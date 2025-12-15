const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middleware/authMiddleware");
const uploadAvatarM = require("../middleware/uploadAvatar");
const {uploadAvatar, deleteAvatar} = require("../controllers/userAvatarController");

router.post("/", authenticateToken, uploadAvatarM.single("avatar"), uploadAvatar);

router.delete("/", authenticateToken, deleteAvatar);

module.exports = router;

