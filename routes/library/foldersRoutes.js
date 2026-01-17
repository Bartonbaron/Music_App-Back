const express = require("express");
const { authenticateToken } = require("../../middleware/auth/authMiddleware");
const { getFolder, getFolders, createFolder, renameFolder, deleteFolder,
    getFolderPlaylists, addPlaylistToFolder,removePlaylistFromFolder
} = require("../../controllers/library/foldersController");

const router = express.Router();

router.get("/", authenticateToken, getFolders);
router.post("/", authenticateToken, createFolder);

router.get("/:id", authenticateToken, getFolder);
router.patch("/:id", authenticateToken, renameFolder);
router.delete("/:id", authenticateToken, deleteFolder);

router.get("/:id/playlists", authenticateToken, getFolderPlaylists);
router.post("/:id/playlists", authenticateToken, addPlaylistToFolder);
router.delete("/:id/playlists/:playlistID", authenticateToken, removePlaylistFromFolder);

module.exports = router;
