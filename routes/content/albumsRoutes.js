const express = require("express");
const router = express.Router();

const uploadCoverM = require("../../middleware/upload/uploadCoverM");

const {getAllAlbums, getMyAlbums, getAlbum, getAlbumSongs, addAlbumToLibrary, removeAlbumFromLibrary,
    createAlbum, updateAlbum, deleteAlbum, addSongToAlbum,
    addSongsToAlbumBulk, removeSongFromAlbum, reorderAlbumSongs,
    uploadAlbumCover, deleteAlbumCover, publishAlbum} = require("../../controllers/content/albumsController");

const {authenticateToken, requireCreator} = require("../../middleware/auth/authMiddleware");

router.get("/", authenticateToken, getAllAlbums);

router.get("/my", authenticateToken, requireCreator, getMyAlbums);

router.get("/:id", authenticateToken, getAlbum);

router.get("/:id/songs", authenticateToken, getAlbumSongs);

router.post("/:id/library", authenticateToken, addAlbumToLibrary);

router.post("/", authenticateToken, requireCreator,
    uploadCoverM.fields([{ name: "cover", maxCount: 1 }]), createAlbum);

router.post("/:albumID/songs/:songID", authenticateToken, requireCreator, addSongToAlbum);

router.post("/:id/cover", authenticateToken, requireCreator,
    uploadCoverM.fields([{ name: "cover", maxCount: 1 }]), uploadAlbumCover);

// Dodawanie wielu utworów jednocześnie
router.post("/:albumID/songs", authenticateToken, requireCreator, addSongsToAlbumBulk);

// Dodanie albumu wraz z utworami (jeden request)
router.post("/publish", authenticateToken, requireCreator, publishAlbum);

router.delete("/:albumID/songs/:songID", authenticateToken, requireCreator, removeSongFromAlbum);

// Zmiana kolejności tracków
router.patch("/:albumID/songs/reorder", authenticateToken, requireCreator, reorderAlbumSongs);

router.patch("/:id", authenticateToken, requireCreator, updateAlbum);

router.delete("/:id", authenticateToken, requireCreator, deleteAlbum);

router.delete("/:id/library", authenticateToken, removeAlbumFromLibrary);

router.delete("/:id/cover", authenticateToken, requireCreator, deleteAlbumCover);

module.exports = router;



