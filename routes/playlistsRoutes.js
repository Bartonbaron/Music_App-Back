const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middleware/authMiddleware");
const {createPlaylist, getUserPlaylists, getPlaylist, getPlaylistActivity, updatePlaylist, deletePlaylist,
    addSongToPlaylist, removeSongFromPlaylist, getPlaylistSongs,
    addPlaylistToLibrary, removePlaylistFromLibrary,
    reorderPlaylistSongs, changePlaylistVisibility, toggleCollaborative,
} = require("../controllers/playlistsController");

router.post("/", authenticateToken, createPlaylist);

router.post("/:id/library", authenticateToken, addPlaylistToLibrary);

router.get("/my", authenticateToken, getUserPlaylists);

router.get("/:id", authenticateToken, getPlaylist);

router.get("/:id/songs", authenticateToken, getPlaylistSongs);

router.get("/:id/activity", authenticateToken, getPlaylistActivity);

router.patch("/:id", authenticateToken, updatePlaylist);

router.patch("/:id/reorder", authenticateToken, reorderPlaylistSongs);

router.patch("/:id/visibility", authenticateToken, changePlaylistVisibility);

router.patch("/:id/collaborative", authenticateToken, toggleCollaborative);

router.delete("/:id", authenticateToken, deletePlaylist);

router.delete("/:id/library", authenticateToken, removePlaylistFromLibrary);

router.post("/:playlistID/songs", authenticateToken, addSongToPlaylist);

router.delete("/:playlistID/songs/:songID", authenticateToken, removeSongFromPlaylist);

module.exports = router;
