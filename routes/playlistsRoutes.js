const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middleware/authMiddleware");
const {createPlaylist, getUserPlaylists, getPlaylist, updatePlaylist, deletePlaylist} = require("../controllers/playlistsController");

router.post("/", authenticateToken, createPlaylist);

router.get("/my", authenticateToken, getUserPlaylists);

router.get("/:id", authenticateToken, getPlaylist);

router.patch("/:id", authenticateToken, updatePlaylist);

router.delete("/:id", authenticateToken, deletePlaylist);

module.exports = router;
