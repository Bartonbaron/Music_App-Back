const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { getFolder, getFolders, createFolder, renameFolder, deleteFolder,
    getFolderPlaylists, addPlaylistToFolder,removePlaylistFromFolder
} = require("../controllers/foldersController");

const router = express.Router();

router.get("/:id", authenticateToken, getFolder);
router.get("/", authenticateToken, getFolders);
router.get("/:id/playlists", authenticateToken, getFolderPlaylists);

router.post("/:id/playlists", authenticateToken, addPlaylistToFolder);
router.post("/", authenticateToken, createFolder);

router.patch("/:id", authenticateToken, renameFolder);

router.delete("/:id", authenticateToken, deleteFolder);
router.delete("/:id/playlists/:playlistID", authenticateToken, removePlaylistFromFolder);

module.exports = router;
